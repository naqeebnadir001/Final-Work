from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import os
os.environ["TOGETHER_API_KEY"] = "808314f23415a0b647a83b4ce6ff7082302278e554fd37e977b65601c1c5dda4"
import re
import logging
import requests
from decimal import Decimal
from docx import Document
from mysql.connector import Error
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain_community.llms import Together
from langchain.prompts import PromptTemplate
from langchain_experimental.text_splitter import SemanticChunker
from langchain.embeddings import HuggingFaceEmbeddings

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# System message to set the context for the chatbot
SYSTEM_MESSAGE = """
You are an insurance chatbot designed to assist users with insurance-related queries. Your role is to:
1. Provide clear and concise answers to questions about insurance policies, products, and processes.
2. Do Not Guide users through the claim filing process.
3. Avoid providing irrelevant or unsolicited information.
4. If you don't know the answer, politely inform the user and suggest alternative ways to find the information.
5. Always maintain a professional and friendly tone.
"""

CLAIM_FIELDS = ['policy_id', 'incidentDate', 'claimType', 'repairCost', 
                'incidentLocation', 'incidentDescription']

class ConversationState:
    def __init__(self):
        self.phase = None  # 'claim'
        self.missing_fields = []
        self.collected_data = {}

class DatabaseHandler:
    def __init__(self, host, port, user, password, database):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.database = database

    def get_connection(self):
        try:
            conn = mysql.connector.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database,
            )
            return conn
        except Error as e:
            logger.error(f"Error connecting to MySQL database: {e}")
            return None

    def get_policy_info(self, policy_id):
        conn = self.get_connection()
        if not conn:
            return None

        cursor = conn.cursor(dictionary=True)
        query = """
        SELECT
          np.policy_number,
          np.license_type,
          np.device_type,
          c.first_name,
          c.last_name,
          c.phone_number,
          c.email,
          c.cnic,
          c.poc_name,
          c.poc_number,
          c.poc_cnic,
          c.address,
          c.office_address,
          c.relationship_with_customer,
          d.brand_name,
          d.device_model,
          d.device_serial_number,
          d.purchase_date,
          d.device_value,
          d.device_condition,
          d.warranty_status,
          np.product_id,
          np.inspector_name,
          np.inspector_phone,
          np.inspector_location,
          np.remarks_ceo,
          np.remarks_coo,
          np.created_at
        FROM
          new_policies np
        LEFT JOIN
          customers c ON np.customer_id = c.customer_id
        LEFT JOIN
          devices d ON np.device_id = d.device_id
        WHERE
          np.policy_id = %s
        """
        cursor.execute(query, (policy_id,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result

    def get_claim_info(self, policy_id):
        conn = self.get_connection()
        if not conn:
            return None

        cursor = conn.cursor(dictionary=True)
        query = "SELECT * FROM claims WHERE policy_id = %s"
        cursor.execute(query, (policy_id,))
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return result

    def create_claim(self, claim_data):
        conn = self.get_connection()
        if not conn:
            return False

        cursor = conn.cursor()
        query = """
        INSERT INTO claims (
          incidentDate,
          claimType,
          repairCost,
          incidentLocation,
          incidentDescription,
          policy_id
        ) VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            claim_data['incidentDate'],
            claim_data['claimType'],
            claim_data['repairCost'],
            claim_data['incidentLocation'],
            claim_data['incidentDescription'],
            claim_data['policy_id']
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return True

    def validate_claim_data(self, claim_data):
        invalid_fields = []

        # Validate incidentDate (should be a valid date format: YYYY-MM-DD)
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', claim_data.get('incidentDate', '')):
            invalid_fields.append('incidentDate')

        # Validate claimType (should not be empty or numeric)
        if not claim_data.get('claimType') or any(char.isdigit() for char in claim_data['claimType']):
            invalid_fields.append('claimType')

        # Validate repairCost (should be a positive number)
        try:
            repair_cost = float(claim_data.get('repairCost', 0))
            if repair_cost <= 0:
                invalid_fields.append('repairCost')
        except (ValueError, TypeError):
            invalid_fields.append('repairCost')

        # Validate incidentLocation (should not be empty)
        if not claim_data.get('incidentLocation'):
            invalid_fields.append('incidentLocation')

        # Validate incidentDescription (should not be empty)
        if not claim_data.get('incidentDescription'):
            invalid_fields.append('incidentDescription')

        # Validate policy_id (should be a positive integer)
        try:
            policy_id = int(claim_data.get('policy_id', 0))
            if policy_id <= 0:
                invalid_fields.append('policy_id')
        except (ValueError, TypeError):
            invalid_fields.append('policy_id')

        return invalid_fields

class DocumentHandler:
    @staticmethod
    def load_documents(file_path):
        doc = Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])

class VectorStoreHandler:
    def __init__(self, persist_directory="./chroma_db"):
        self.persist_directory = persist_directory
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    def create_vector_store(self, documents):
        vectorstore = Chroma.from_texts([documents], self.embeddings, persist_directory=self.persist_directory)
        vectorstore.persist()
        return vectorstore

    def load_or_create_vectorstore(self, documents):
        if os.path.exists(self.persist_directory):
            return Chroma(persist_directory=self.persist_directory, embedding_function=self.embeddings)
        else:
            return self.create_vector_store(documents)

class Chatbot:
    def __init__(self, vectorstore):
        self.vectorstore = vectorstore
        self.llm = Together(model="mistralai/Mistral-7B-Instruct-v0.1")
        self.qa_chain = RetrievalQA.from_chain_type(llm=self.llm, retriever=self.vectorstore.as_retriever())

    def generate_response(self, query, documents):
        try:
            full_query = f"{SYSTEM_MESSAGE}\n\nUser Query: {query}"
            docs = self.vectorstore.similarity_search(full_query, k=5)
            context = "\n".join([doc.page_content for doc in docs])

            if not context:
                return "I'm sorry, I couldn't find relevant information to answer your question. Please try rephrasing or ask another question."

            prompt = f"{SYSTEM_MESSAGE}\n\nUser Query: {query}\n\nBased on the following information, generate a conversational response:\n\n{documents}\n\nBot:"
            response = self.qa_chain.invoke(prompt)
            return response if isinstance(response, str) else response.get("result", "Error generating response")
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "I'm sorry, something went wrong while processing your request. Please try again."

# Initialize components
db_handler = DatabaseHandler(
    host="mysql-11613de7-insurance-crm.f.aivencloud.com",
    port=26392,
    user="avnadmin",
    password="AVNS_Bb3O_Yl-biwqrry1i9k",
    database="insurance_crm",
)

document_handler = DocumentHandler()
documents = document_handler.load_documents("claim-dataset.docx")

vectorstore_handler = VectorStoreHandler()
vectorstore = vectorstore_handler.load_or_create_vectorstore(documents)

chatbot = Chatbot(vectorstore)

state = ConversationState()

@app.route('/chat', methods=['POST'])
def handle_chat():
    user_input = request.json.get('message')
    
    if "confirm" in user_input.lower():
        state.phase = 'claim'
        state.missing_fields = ['policy_id']  # First ask for policy ID
        return jsonify({"response": "To file a claim, I'll need your policy ID. Please provide it."})
    
    elif state.phase == 'claim':
        if 'policy_id' not in state.collected_data:
            # First ask for policy ID
            policy_id = user_input
            
            # Validate policy ID is a positive integer
            try:
                policy_id = int(policy_id)
                if policy_id <= 0:
                    raise ValueError
            except ValueError:
                return jsonify({"response": "The policy ID provided is invalid. Please provide a valid positive integer policy ID."})
            
            # Check if policy exists
            policy_info = db_handler.get_policy_info(policy_id)
            if not policy_info:
                return jsonify({"response": "The policy ID provided doesn't exist in our system. Please verify and try again."})
            
            # Check if claim already exists
            existing_claim = db_handler.get_claim_info(policy_id)
            if existing_claim:
                # Claim exists, return the details
                response_message = "I found an existing claim for this policy:\n\n"
                for key, value in existing_claim.items():
                    if key != 'claim_id':  # Skip internal ID
                        response_message += f"{key}: {value}\n"
                return jsonify({"response": response_message})
            else:
                # No claim exists, proceed to collect claim information
                state.collected_data['policy_id'] = policy_id
                state.missing_fields = CLAIM_FIELDS.copy()
                state.missing_fields.remove('policy_id')  # Already have policy ID
                next_field = state.missing_fields[0]
                return jsonify({"response": f"Please provide the {next_field} (YYYY-MM-DD format)."})
        else:
            if state.missing_fields:
                next_field = state.missing_fields[0]
                state.collected_data[next_field] = user_input
                
                # Validate the input
                invalid_fields = db_handler.validate_claim_data(state.collected_data)
                if next_field in invalid_fields:
                    error_msg = {
                        'incidentDate': "Please provide a valid date in YYYY-MM-DD format.",
                        'claimType': "Please provide a valid claim type (text only, no numbers).",
                        'repairCost': "Please provide a valid positive number for repair cost.",
                        'incidentLocation': "Please provide a valid incident location.",
                        'incidentDescription': "Please provide a valid incident description."
                    }.get(next_field, f"The information provided for {next_field} is invalid.")
                    
                    return jsonify({"response": error_msg})
                else:
                    state.missing_fields.remove(next_field)
                    if state.missing_fields:
                        next_field = state.missing_fields[0]
                        prompt = f"Please provide the {next_field}."
                        return jsonify({"response": prompt})
                    else:
                        # All fields collected, proceed to create claim
                        if db_handler.create_claim(state.collected_data):
                            # Prepare the response with collected data
                            response_message = "Thank you! Your claim has been filed successfully.\n\nHere are the details you provided:\n"
                            for key, value in state.collected_data.items():
                                response_message += f"{key}: {value}\n"
                            
                            # Add policy information
                            #policy_info = db_handler.get_policy_info(state.collected_data['policy_id'])
                            #if policy_info:
                             #   response_message += "\nPolicy Information:\n"
                              #  response_message += f"Policy Number: {policy_info['policy_number']}\n"
                               # response_message += f"Customer Name: {policy_info['first_name']} {policy_info['last_name']}\n"
                                #response_message += f"Device: {policy_info['brand_name']} {policy_info['device_model']}\n"
                            
                            return jsonify({"response": response_message})
                        else:
                            return jsonify({"response": "Sorry, there was an error saving your claim. Please try again later."})
            else:
                # If no missing fields, return the final response
                response_message = "Thank you! Your claim has been filed successfully.\n\nHere are the details you provided:\n"
                for key, value in state.collected_data.items():
                    response_message += f"{key}: {value}\n"
                
                return jsonify({"response": response_message})
    
    else:
        # General insurance chat
        response = chatbot.generate_response(user_input, documents)
        return jsonify({"response": response})

if __name__ == '__main__':
    app.run(port=5001, debug=True)