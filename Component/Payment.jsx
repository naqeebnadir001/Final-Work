import React, { useState } from "react";
import emailjs from "emailjs-com";
import "./Payment.css";
import Navbar from "./navbar";
import easyPaisaLogo from "../assets/easypaisa.png"; // Add the correct path
import jazzCashLogo from "../assets/jazzcash.webp"; // Add the correct path

const PaymentForm = () => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    number: "",
    amount: "",
  });
  const [errors, setErrors] = useState({});

  const handleSelectMethod = (method) => {
    setSelectedMethod(method);
    setFormData({ firstName: "", lastName: "", number: "", amount: "" });
    setErrors({});
  };

  // Validation function
  const validate = () => {
    const errors = {};
    const { firstName, lastName, number, amount } = formData;

    if (!/^[a-zA-Z]+$/.test(firstName))
      errors.firstName = "First name must contain only alphabets";
    if (!/^[a-zA-Z]+$/.test(lastName))
      errors.lastName = "Last name must contain only alphabets";

    if (!/^\d{11}$/.test(number))
      errors.number = `${selectedMethod} number must be 11 digits`;

    if (amount <= 1 || amount === "")
      errors.amount = "Amount must be greater than 1";

    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      emailjs
        .sendForm(
          "service_k8jlzmh",
          "template_33datfl",
          e.target,
          "D6aEi7IvSwkRs1V2y"
        )
        .then(
          (result) => {
            console.log("Email sent successfully: ", result.text);
            alert("Payment info has been sent successfully!");
            setFormData({ firstName: "", lastName: "", number: "", amount: "" });
            setSelectedMethod(null);
          },
          (error) => {
            console.error("Error sending email: ", error.text);
            alert("There was an error while sending the payment details.");
          }
        );
    }
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({ ...prevState, [name]: value }));
  };

  return (
    <div className="container">
      <Navbar />
      <h2>Select Payment Method</h2>
      {!selectedMethod ? (
        <div className="button-container">
          <button className="payment-button easyPaisa" onClick={() => handleSelectMethod("EasyPaisa")}>
            <img src={easyPaisaLogo} alt="EasyPaisa Logo" className="logo" />
            Pay with EasyPaisa
          </button>
          <button className="payment-button jazzCash" onClick={() => handleSelectMethod("JazzCash")}>
            <img src={jazzCashLogo} alt="JazzCash Logo" className="logo" />
            Pay with JazzCash
          </button>
        </div>
      ) : (
        <div className="form-container">
          <h3>{selectedMethod} Payment</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>First Name</label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} />
              {errors.firstName && <p className="error">{errors.firstName}</p>}
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} />
              {errors.lastName && <p className="error">{errors.lastName}</p>}
            </div>
            <div className="form-group">
              <label>{selectedMethod} Number</label>
              <input type="text" name="number" value={formData.number} onChange={handleChange} />
              {errors.number && <p className="error">{errors.number}</p>}
            </div>
            <div className="form-group">
              <label>Amount</label>
              <input type="number" name="amount" value={formData.amount} onChange={handleChange} />
              {errors.amount && <p className="error">{errors.amount}</p>}
            </div>
            <div className="button-group">
              <button type="submit" className="pay-button">
                Pay
              </button>
              <button type="button" className="cancel-button" onClick={() => setSelectedMethod(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;