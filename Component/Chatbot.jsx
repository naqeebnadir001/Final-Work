import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Chatbot.css'

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatbotInitialized, setChatbotInitialized] = useState(false);

  // Initialize the chatbot when the component mounts
  useEffect(() => {
    if (!chatbotInitialized) {
      axios.get('http://127.0.0.1:5000/init')
        .then(response => {
          setMessages([{ text: response.data.response, sender: 'bot' }]);
          setChatbotInitialized(true);
        })
        .catch(error => {
          console.error('Error initializing chatbot:', error);
        });
    }
  }, [chatbotInitialized]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    const userMessage = { text: input, sender: 'user' };
    setMessages([...messages, userMessage]);

    try {
      const response = await axios.post('http://127.0.0.1:5000/chat', { message: input });
      const botMessage = { text: response.data.response, sender: 'bot' };
      setMessages([...messages, userMessage, botMessage]);
    } catch (error) {
      console.error('Error communicating with the chatbot:', error);
    }

    setInput('');
  };

  return (
    <div className="chatbot-container">
      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default Chatbot;