(() => {
  'use strict';

  const courseSelect = document.getElementById('course-select');
  const summaryCourseName = document.getElementById('summary-course-name');
  const summaryAmount = document.getElementById('summary-amount');
  const payButton = document.getElementById('pay-now-button');
  const statusBox = document.getElementById('payment-status-box');
  const receiptCard = document.getElementById('receipt-card');
  const checkoutForm = document.getElementById('checkout-form');

  const formatMoney = (paise) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(paise / 100);
  };

  const updateSummary = () => {
    if (!courseSelect) return;
    const selectedOption = courseSelect.options[courseSelect.selectedIndex];
    const paise = Number(selectedOption.value);
    const courseName = selectedOption.getAttribute('data-name') || selectedOption.text;
    
    if (summaryCourseName) summaryCourseName.textContent = courseName;
    if (summaryAmount) summaryAmount.textContent = formatMoney(paise);
  };

  const showStatus = (message, type = 'info') => {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.style.padding = '12px 16px';
    statusBox.style.borderRadius = '6px';
    statusBox.style.fontSize = '14px';
    statusBox.style.marginTop = '16px';

    if (type === 'error') {
      statusBox.style.background = '#ffebe9';
      statusBox.style.color = '#cf222e';
      statusBox.style.border = '1px solid #ff8182';
    } else if (type === 'warning') {
      statusBox.style.background = '#fff8c5';
      statusBox.style.color = '#9a6700';
      statusBox.style.border = '1px solid #d4a72c';
    } else if (type === 'success') {
      statusBox.style.background = '#dafbe1';
      statusBox.style.color = '#1a7f37';
      statusBox.style.border = '1px solid #4ac26b';
    } else {
      statusBox.style.background = '#ddf4ff';
      statusBox.style.color = '#0969da';
      statusBox.style.border = '1px solid #54aeff';
    }
  };

  const enableButton = () => {
    if (payButton) {
      payButton.disabled = false;
      payButton.textContent = 'Pay with Razorpay ↗';
    }
  };

  const disableButton = () => {
    if (payButton) {
      payButton.disabled = true;
      payButton.textContent = 'Processing Payment...';
    }
  };

  const showSuccessReceipt = (response, amountPaise) => {
    showStatus('Payment successfully verified by server!', 'success');
    if (receiptCard) {
      receiptCard.hidden = false;
      document.getElementById('receipt-payment-id').textContent = response.razorpay_payment_id;
      document.getElementById('receipt-order-id').textContent = response.razorpay_order_id;
      document.getElementById('receipt-amount').textContent = formatMoney(amountPaise);
      receiptCard.scrollIntoView({ behavior: 'smooth' });
    }
    if (payButton) {
      payButton.disabled = true;
      payButton.textContent = 'Payment Completed ✓';
    }
  };

  const handleCheckout = async () => {
    if (!courseSelect) return;

    const selectedOption = courseSelect.options[courseSelect.selectedIndex];
    const amountPaise = Number(selectedOption.value);
    const courseName = selectedOption.getAttribute('data-name') || selectedOption.text;
    const courseCode = selectedOption.getAttribute('data-code') || 'COURSE';

    const nameInput = document.getElementById('student-name');
    const emailInput = document.getElementById('student-email');
    const phoneInput = document.getElementById('student-phone');

    const studentName = nameInput?.value.trim() || '';
    const studentEmail = emailInput?.value.trim() || '';
    const studentPhone = phoneInput?.value.trim() || '';

    // Validate inputs
    if (!studentName) {
      showStatus('Please enter your full name.', 'error');
      nameInput?.focus();
      return;
    }
    if (!studentEmail || !studentEmail.includes('@')) {
      showStatus('Please enter a valid email address.', 'error');
      emailInput?.focus();
      return;
    }
    if (!studentPhone || studentPhone.replace(/\D/g, '').length < 10) {
      showStatus('Please enter a valid 10-digit mobile number.', 'error');
      phoneInput?.focus();
      return;
    }

    if (typeof window.Razorpay === 'undefined') {
      showStatus('Razorpay Checkout SDK is not loaded. Please check your internet connection or reload the page.', 'error');
      return;
    }

    disableButton();
    showStatus('Creating payment order with Razorpay...', 'info');

    try {
      // STEP 1: Call Backend to Create Order
      const orderResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt: `rcpt_${courseCode}_${Date.now()}`
        })
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.order_id) {
        throw new Error(orderData.error || 'Failed to create payment order on server.');
      }

      showStatus('Opening Razorpay Checkout modal...', 'info');

      // STEP 2: Configure & Open Razorpay Standard Checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'KBC Computer Education',
        description: courseName,
        order_id: orderData.order_id,
        prefill: {
          name: studentName,
          email: studentEmail,
          contact: studentPhone
        },
        theme: {
          color: '#071426'
        },
        handler: async function (response) {
          // On payment success on client modal, verify signature on backend
          showStatus('Payment authorized. Verifying cryptographic signature on server...', 'info');

          try {
            // STEP 3: Call Backend to Verify Signature
            const verifyResponse = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok && verifyData.success) {
              showSuccessReceipt(response, orderData.amount);
            } else {
              showStatus(`Verification failed: ${verifyData.error || 'Signature rejected by server.'}`, 'error');
              enableButton();
            }
          } catch (verifyErr) {
            console.error('Error during signature verification:', verifyErr);
            showStatus('Network error while verifying payment. Please contact KBC with your Payment ID.', 'error');
            enableButton();
          }
        },
        modal: {
          ondismiss: function () {
            showStatus('Payment cancelled: Razorpay checkout modal was closed without completing the payment.', 'warning');
            enableButton();
          }
        }
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on('payment.failed', function (failureResponse) {
        console.error('Razorpay payment failure:', failureResponse);
        const reason = failureResponse.error?.description || failureResponse.error?.reason || 'Payment could not be completed.';
        showStatus(`Payment failed: ${reason}`, 'error');
        enableButton();
      });

      razorpayInstance.open();

    } catch (err) {
      console.error('Order creation error:', err);
      showStatus(`Error: ${err.message}`, 'error');
      enableButton();
    }
  };

  if (courseSelect) {
    courseSelect.addEventListener('change', updateSummary);
    updateSummary();
  }

  if (payButton) {
    payButton.addEventListener('click', handleCheckout);
  }
})();
