import smtplib
import json
import urllib.parse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configuration
EMAIL_USER = "meraryanto@gmail.com"
EMAIL_PASS = "ftdx ipus nbqo acvp"
FROM_EMAIL = "YATRA 2026 <meraryanto@gmail.com>"

def send_email(to_email, subject, html_content, text_content):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email

    part1 = MIMEText(text_content, "plain")
    part2 = MIMEText(html_content, "html")

    msg.attach(part1)
    msg.attach(part2)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.sendmail(EMAIL_USER, to_email, msg.as_string())
        print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")

def generate_brutalist_html(name, email, phone, college, ticket_type, price, ticket_code, qr_url, is_rit):
    rit_badge = '<div style="background: #0f0; padding: 12px 20px; border-top: 2px solid #000; font-weight: 700; text-transform: uppercase;">RIT STUDENT DISCOUNT APPLIED</div>' if is_rit else ''
    
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YATRA 2026 // ENTRY PASS</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #000; font-family: 'Courier New', Courier, monospace;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border: 6px solid #000;">
    <div style="background: #000; padding: 30px 20px; text-align: center; border-bottom: 6px solid #ff0;">
      <h1 style="color: #fff; margin: 0; font-size: 48px; font-weight: 900; letter-spacing: 8px; text-transform: uppercase;">YATRA</h1>
      <div style="color: #ff0; font-size: 24px; font-weight: 700; margin-top: 5px; letter-spacing: 4px;">2026</div>
    </div>
    <div style="padding: 30px 25px; background: #fff;">
      <div style="border: 4px solid #000; padding: 20px; margin-bottom: 25px; background: #f0f0f0;">
        <p style="margin: 0; font-size: 18px; font-weight: 700; text-transform: uppercase;">ATTENDEE:</p>
        <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: 900; color: #000; text-transform: uppercase;">{name}</p>
      </div>
      <div style="border: 4px solid #000; margin-bottom: 25px;">
        <div style="background: #000; color: #fff; padding: 12px 20px; font-size: 14px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">REGISTRATION DATA</div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 2px solid #000;">
            <td style="padding: 15px 20px; font-weight: 700; text-transform: uppercase; width: 35%; background: #f0f0f0; border-right: 2px solid #000;">EMAIL</td>
            <td style="padding: 15px 20px; font-weight: 500;">{email}</td>
          </tr>
          <tr style="border-bottom: 2px solid #000;">
            <td style="padding: 15px 20px; font-weight: 700; text-transform: uppercase; background: #f0f0f0; border-right: 2px solid #000;">PHONE</td>
            <td style="padding: 15px 20px; font-weight: 500;">{phone}</td>
          </tr>
          <tr style="border-bottom: 2px solid #000;">
            <td style="padding: 15px 20px; font-weight: 700; text-transform: uppercase; background: #f0f0f0; border-right: 2px solid #000;">COLLEGE</td>
            <td style="padding: 15px 20px; font-weight: 500;">{college}</td>
          </tr>
          <tr style="border-bottom: 2px solid #000;">
            <td style="padding: 15px 20px; font-weight: 700; text-transform: uppercase; background: #f0f0f0; border-right: 2px solid #000;">PASS TYPE</td>
            <td style="padding: 15px 20px; font-weight: 700;">{ticket_type}</td>
          </tr>
          <tr>
            <td style="padding: 15px 20px; font-weight: 700; text-transform: uppercase; background: #ff0; border-right: 2px solid #000;">PRICE</td>
            <td style="padding: 15px 20px; font-size: 24px; font-weight: 900; background: #ff0;">{price}</td>
          </tr>
        </table>
        {rit_badge}
      </div>
      
      <div style="border: 6px solid #000; background: #000; padding: 25px; margin-bottom: 25px;">
        <div style="text-align: center;">
          <p style="margin: 0 0 15px 0; color: #ff0; font-size: 14px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;">// ENTRY CODE //</p>
          <div style="background: #fff; display: inline-block; padding: 20px 40px; border: 4px solid #ff0;">
            <span style="font-size: 48px; font-weight: 900; letter-spacing: 10px; color: #000;">{ticket_code}</span>
          </div>
        </div>
        <div style="text-align: center; margin-top: 25px; padding-top: 25px; border-top: 2px dashed #333;">
          <p style="margin: 0 0 15px 0; color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">SCAN TO ENTER</p>
          <div style="background: #fff; display: inline-block; padding: 15px; border: 4px solid #ff0;">
            <img src="{qr_url}" alt="QR" style="width: 180px; height: 180px; display: block;" />
          </div>
        </div>
      </div>
      <div style="border: 4px solid #f00; background: #f00; padding: 15px 20px; margin-bottom: 25px;">
        <p style="margin: 0; color: #fff; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">WARNING: BRING VALID ID + THIS TICKET FOR ENTRY VERIFICATION</p>
      </div>

      <div style="background: #f0f0f0; border: 4px solid #000; padding: 20px;">
        <p style="margin: 0; font-size: 16px; font-weight: 500; line-height: 1.6;">Get ready for the biggest cultural fest. See you there.</p>
      </div>
    </div>
    <div style="background: #000; padding: 20px; border-top: 6px solid #ff0;">
      <p style="margin: 0; color: #fff; font-size: 12px; text-align: center; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">RAJALAKSHMI INSTITUTE OF TECHNOLOGY</p>
      <p style="margin: 8px 0 0 0; color: #666; font-size: 10px; text-align: center; text-transform: uppercase; letter-spacing: 1px;">YATRA 2026 // AUTOMATED SYSTEM</p>
    </div>
  </div>
</body>
</html>"""

def generate_text_content(name, email, phone, college, ticket_type, price, ticket_code, is_rit):
    return f"""========================================
          YATRA 2026
          ENTRY PASS
========================================

ATTENDEE: {name}

----------------------------------------
REGISTRATION DATA
----------------------------------------
EMAIL:     {email}
PHONE:     {phone}
COLLEGE:   {college}
PASS TYPE: {ticket_type}
PRICE:     {price}
{'STATUS:    RIT STUDENT DISCOUNT' if is_rit else ''}
----------------------------------------

========================================
        ENTRY CODE: {ticket_code}
========================================

Present this code or scan QR at entrance.

!! WARNING: BRING VALID ID FOR VERIFICATION !!

----------------------------------------
RAJALAKSHMI INSTITUTE OF TECHNOLOGY
YATRA 2026 // AUTOMATED SYSTEM"""

if __name__ == "__main__":
    users = [
        {
            "name": "Javagalnath v",
            "email": "Javagalnath.v.2023.cce@ritchennai.edu.in",
            "phone": "9751067393",
            "college": "2117230010021",
            "ticket_type": "Student Pass",
            "price": "300.0",
            "is_rit": True,
            "ticket_code": "235770",
            "qr_payload": "94d6b07a-928a-4d91-ac73-e0f04d580a0a.d8f6c415655d5763586796b6693d03d02b2bb01be99725c349d22b1bd7abaa1c"
        },
        {
            "name": "Karan",
            "email": "karan.s.2024.aids@rajalakshmi.edu.in",
            "phone": "+91 733 918 8168",
            "college": "REC",
            "ticket_type": "General Public",
            "price": "500.0",
            "is_rit": False,
            "ticket_code": "338981",
            "qr_payload": "67edf7d1-c18d-43e8-b693-c54259d0a285.558b1e811778dedd4b303d934bf27c356eb201bbf635dc209ea77af22bed9ec4"
        }
    ]

    for user in users:
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={urllib.parse.quote(user['qr_payload'])}"
        
        print(f"Sending email to {user['email']}...")
        
        html = generate_brutalist_html(
            user['name'], user['email'], user['phone'], user['college'],
            user['ticket_type'], user['price'], user['ticket_code'], qr_url, user['is_rit']
        )
        
        text = generate_text_content(
            user['name'], user['email'], user['phone'], user['college'],
            user['ticket_type'], user['price'], user['ticket_code'], user['is_rit']
        )
        
        send_email(user['email'], "YATRA 2026 // ENTRY PASS CONFIRMED", html, text)
