import React, { useState } from 'react';

const PaymentForm = () => {
  const [cnic, setCnic] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deviceSerialNumber, setDeviceSerialNumber] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/create-policy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cnic,
          first_name: firstName,
          last_name: lastName,
          email,
          phone_number: phoneNumber,
          device_serial_number: deviceSerialNumber,
        }),
      });
      const data = await response.json();
      alert(data.message);
    } catch (error) {
      console.error('Error creating policy:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="CNIC"
        value={cnic}
        onChange={(e) => setCnic(e.target.value)}
      />
      <input
        type="text"
        placeholder="First Name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <input
        type="text"
        placeholder="Last Name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="text"
        placeholder="Phone Number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />
      <input
        type="text"
        placeholder="Device Serial Number"
        value={deviceSerialNumber}
        onChange={(e) => setDeviceSerialNumber(e.target.value)}
      />
      <button type="submit">Create Policy</button>
    </form>
  );
};

export default PaymentForm;