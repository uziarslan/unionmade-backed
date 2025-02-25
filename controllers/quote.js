const mongoose = require("mongoose");
const Quote = mongoose.model("Quote");
const { MailtrapClient } = require("mailtrap");

// Mailtrap Integration
const TOKEN = process.env.MAIL_TRAP_TOKEN;
const client = new MailtrapClient({ token: TOKEN });
const sender = {
  email: "info@unionmade.net",
  name: "Union Made Apparel",
};

const submitQuote = async (req, res) => {
  const quote = new Quote({ ...req.body });
  await quote.save();

  client.send({
    from: sender,
    to: [
      {
        email: quote.username,
      },
      {
        email: "chaudhryuzairarslan2000@gmail.com",
      },
    ],
    template_uuid: "a8fe3031-ab94-4ba5-9b80-21d54536c197",
    template_variables: {
      quote,
    },
  });

  res.status(201).json({ success: "Your message has been submitted" });
};

module.exports = {
  submitQuote,
};
