const nodemailer = require('nodemailer');
async function test() {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'multiverseglobals@gmail.com',
        pass: 'lbaexfdrazssvfgk'
      }
    });
    const info = await transporter.sendMail({
      from: 'multiverseglobals@gmail.com',
      to: 'multiverseglobals@gmail.com',
      subject: 'Test Email from Atlas',
      text: 'If you are reading this, the SMTP App Password works perfectly!'
    });
    console.log('Success:', info.messageId);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
