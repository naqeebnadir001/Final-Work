import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');  // URL of your Flask server

const ChatInterface = () => {
    const [message, setMessage] = useState('');
    const [chat, setChat] = useState([]);

    const sendChat = (e) => {
        e.preventDefault();
        socket.emit('message', { message });
        setMessage('');
    };

    useEffect(() => {
        socket.on('response', (data) => {
            setChat([...chat, data.message]);
        });

        return () => {
            socket.off('response');
        };
    }, [chat]);

    return (
        <div>
            <form onSubmit={sendChat}>
                <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} />
                <button type="submit">Send</button>
            </form>
            {chat.map((msg, index) => (
                <p key={index}>{msg}</p>
            ))}
        </div>
    );
};

export default ChatInterface;
