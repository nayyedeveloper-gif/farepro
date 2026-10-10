import React, { useState } from 'react';
import Navbar from './Navbar';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="tl-landing">
      <Navbar />
      <section className="tl-page-header">
        <div className="tl-page-inner">
          <h1>Contact Sale</h1>
          <p>Tell us about your fleet and we'll get back to you within 24 hours.</p>
        </div>
      </section>
      <section className="tl-page-body">
        <div className="tl-page-inner">
          <div className="tl-contact-form-wrap">
            {submitted ? (
              <div className="tl-contact-success">
                <h2>Thanks for reaching out!</h2>
                <p>We'll get back to you at {formData.email} within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="tl-contact-form">
                <div className="zello-field">
                  <label>Name</label>
                  <input name="name" type="text" value={formData.name} onChange={handleChange} required placeholder="John Doe" autoFocus />
                </div>
                <div className="zello-field">
                  <label>Work Email</label>
                  <input name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="john@company.com" />
                </div>
                <div className="zello-field">
                  <label>Company</label>
                  <input name="company" type="text" value={formData.company} onChange={handleChange} required placeholder="Acme Fleet Co." />
                </div>
                <div className="zello-field">
                  <label>Message</label>
                  <textarea name="message" value={formData.message} onChange={handleChange} required rows={4} placeholder="Tell us about your fleet size and needs..." />
                </div>
                <button type="submit" className="zello-submit-btn">Send Message</button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
