const Imap = require("imap");
const { simpleParser } = require("mailparser");

const imap = new Imap({
  user: "your_email@gmail.com",
  password: "your_password",
  host: "imap.gmail.com",
  port: 3001,
  tls: true,
});

imap.connect();

imap.once("ready", () => {
  imap.openBox("INBOX", false, (err, box) => {
    if (err) throw err;

    imap.on("mail", async (numNewMsgs) => {
      console.log(`You have ${numNewMsgs} new message(s)`);
      // Fetch and process new messages
      fetchNewMessages();
    });
  });
});

imap.once("error", (err) => {
  console.error(err);
});

function fetchNewMessages() {
  const fetchOptions = {
    bodies: ["HEADER", "TEXT"],
    markSeen: false,
  };

  imap.search(["UNSEEN"], (err, results) => {
    if (err) throw err;

    const fetch = imap.fetch(results, fetchOptions);
    fetch.on("message", (msg) => {
      msg.on("body", async (stream, info) => {
        const parsed = await simpleParser(stream);
        const subject = parsed.subject;
        const from = parsed.from.text;
        const body = parsed.text;

        console.log(`Subject: ${subject}`);
        console.log(`From: ${from}`);
        console.log(`Body: ${body}`);
      });
    });
  });
}
