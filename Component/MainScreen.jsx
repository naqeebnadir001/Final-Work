import React, { useState } from 'react';
import './MainScreen.css';
import PaymentForm from './Payment';
import Navbar from './navbar';

const PaymentChatbotButtons = () => {
  const [showPayment, setShowPayment] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isClaim, setIsClaim] = useState(false); // Track if it's claim-related or policy-related

  const handlePaymentClick = () => {
    setShowPayment(true);
    setShowChatOptions(false);
    setShowChat(false);
    setIsClaim(false);  // Reset to non-claim-related chat
  };

  const handleChatClick = () => {
    setShowChatOptions(true);
    setShowPayment(false);
    setShowChat(false);
  };

  const handleFileClaimClick = () => {
    setShowChat(true);
    setShowChatOptions(false);
    setIsClaim(true); // Set the chat to claim-related
    setMessages([{ sender: 'bot', message: "Hello! I'm your claim assistant. How can I help you today?" }]);
  };

  const handleCreatePolicyClick = () => {
    setShowChat(true);
    setShowChatOptions(false);
    setIsClaim(false); // Set the chat to policy-related
    setMessages([{ sender: 'bot', message: "Hello! I'm your insurance assistant. How can I help you today?" }]);
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;

    const userMessage = { sender: 'user', message: inputValue };
    setMessages([...messages, userMessage]);
    setInputValue('');

    // Choose the backend URL based on whether it's a claim or policy-related chat
    const backendUrl = isClaim ? 'http://localhost:5001/chat' : 'http://localhost:5000/chat';

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: inputValue }),
    });

    const data = await response.json();
    const botMessage = { sender: 'bot', message: data.response };
    setMessages([...messages, userMessage, botMessage]);
  };

  return (
    <>
      <Navbar />
      <div className="buttons-container">
        {!showPayment && !showChatOptions && !showChat ? (
          <>
            <button className="button easy-paisa-button" onClick={handleChatClick}>
              <span className="button-icon">💬</span> Chatbot
            </button>
            <button className="button payment-button" onClick={handlePaymentClick}>
              <span className="button-icon">💳</span> Payment
            </button>
          </>
        ) : showPayment ? (
          <PaymentForm />
        ) : showChatOptions ? (
          <div className="extra-buttons">
            <button className="button file-claim-button" onClick={handleFileClaimClick}>
              <span className="button-icon">📝</span> File a Claim
            </button>
            <button className="button create-policy-button" onClick={handleCreatePolicyClick}>
              <span className="button-icon">🛡️</span> Create a Policy
            </button>
          </div>
        ) : (
          <div className="chat-window">
            <div className="chat-messages">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender}`}>
                  {msg.message}
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button onClick={handleSendMessage}>Send</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PaymentChatbotButtons;
