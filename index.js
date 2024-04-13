// require("dotenv").config();
// const { Buffer } = require("buffer");
// const fs = require("fs");
// const Imap = require("imap");
// const { simpleParser } = require("mailparser");
const tlsOptions = {
  rejectUnauthorized: false,
};

// const imap = new Imap({
//   user: process.env.EMAIL_USER,
//   password: process.env.EMAIL_PASS,
//   host: "imap.qlc.co.in",
//   port: 993,
//   tls: tlsOptions,
// });

// imap.connect();

// function downloadAttachments(parsed) {
//   console.log("Downloading attachments...");
//   return new Promise((resolve, reject) => {
//     const attachments = parsed.attachments || [];

//     attachments.forEach((attachment) => {
//       const filename = attachment.filename || "attachment.dat";
//       const writeStream = fs.createWriteStream(filename);
//       const decodedContent = Buffer.from(attachment.content, "base64"); // Decode the base64 content

//       attachment.stream.on("data", (chunk) => {
//         console.log("chunks" + chunk);
//         if (chunk.length > 0) {
//           decodedContent.pipe(writeStream);
//         } else {
//           console.log(`Skipping empty attachment: ${attachment.filename}`);
//         }
//       });
//       writeStream.on("finish", () => {
//         console.log(`Attachment '${filename}' downloaded successfully!`);
//       });

//       writeStream.on("error", (err) => {
//         console.error(`Error downloading attachment '${filename}': ${err}`);
//         reject(err);
//       });

//       writeStream.on("close", () => {
//         console.log(`Write stream closed for '${filename}'`);
//         resolve();
//       });

//       writeStream.end();
//     });
//   });
// }

// async function processMessage(msg) {
//   console.log("Processing message...");
//   const attachments = [];

//   msg.on("body", (stream, info) => {
//     if (info.which === "HEADER") return;

//     simpleParser(stream, async (err, parsed) => {
//       if (err) {
//         console.error("Error parsing email:", err);
//         return;
//       }
//       console.log("From:", parsed.from.text);
//       console.log("Subject:", parsed.subject);
//       console.log("Text:", parsed.text);

//       console.log("Attachments:", parsed.attachments);
//       attachments.push(parsed);
//     });
//   });

//   return new Promise((resolve) => {
//     msg.once("end", async () => {
//       for (const attachment of attachments) {
//         await downloadAttachments(attachment);
//       }
//       console.log("Attachments downloaded for this message.");
//       resolve();
//     });
//   });
// }

// imap.once("ready", () => {
//   console.log("IMAP connection established.");
//   imap.openBox("INBOX", false, (err, box) => {
//     if (err) {
//       console.error("Error opening INBOX:", err);
//       return;
//     }
//     imap.search(["SEEN", ["SINCE", "April 2, 2022"]], (err, results) => {
//       if (err) {
//         console.error("Error searching for messages:", err);
//         return;
//       }
//       const fetch = imap.fetch(results, { bodies: "", struct: true });

//       fetch.on("message", async (msg) => {
//         await processMessage(msg);
//         console.log("Message processed.");
//       });

//       fetch.once("error", (ex) => {
//         console.error("Fetch error:", ex);
//       });

//       fetch.once("end", () => {
//         console.log("Done fetching all messages");
//         imap.end();
//       });
//     });
//   });
// });
// imap.once("error", (err) => {
//   console.error("IMAP error:", err);
// });
// imap.once("end", () => {
//   console.log("Connection ended");
// });
require("dotenv").config();
const fs = require("fs");
const base64 = require("base64-stream");
const Imap = require("imap");
// const streamifier = require("streamifier");

const imap = new Imap({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: "imap.qlc.co.in",
  port: 993,
  tls: true,
});
imap.connect();
function findAttachmentParts(struct, attachments) {
  attachments = attachments || [];
  for (var i = 0, len = struct.length, r; i < len; ++i) {
    if (Array.isArray(struct[i])) {
      findAttachmentParts(struct[i], attachments);
    } else {
      if (
        struct[i].disposition &&
        ["INLINE", "ATTACHMENT"].indexOf(
          (struct[i].disposition.type || "").toUpperCase()
        ) > -1
      ) {
        attachments.push(struct[i]);
      }
    }
  }
  return attachments;
}

function buildAttMessageFunction(attachment) {
  return function (msg, seqno) {
    if (
      !attachment ||
      !attachment.disposition.params ||
      !attachment.disposition.params.filename
    ) {
      console.log("Invalid attachment object:", attachment);
      return;
    }

    console.log("Processing attachment:", attachment);

    var filename = attachment.disposition.params.filename;
    console.log("HI" + filename);
    var encoding = attachment.encoding;
    var prefix = "(#" + seqno + ") ";
    msg.on("body", function (stream, info) {
      console.log(prefix + "Streaming this attachment to file", filename, info);
      var writeStream = fs.createWriteStream(filename);
      writeStream.on("finish", function () {
        console.log(prefix + "Done writing to file %s", filename);
      });

      if ((encoding || "").toUpperCase() === "BASE64") {
        var decodedChunks = [];
        console.log("YO1");
        stream.on("data", function (chunk) {
          try {
            writeStream.write(Buffer.from(chunk, "base64"));
          } catch (err) {
            console.error("Error writing attachment:", err);
          }
        });
        stream.on("end", function () {
          writeStream.write(Buffer.concat(decodedChunks));
          writeStream.end();
        });
      } else {
        stream.pipe(writeStream);
      }
    });
    msg.once("end", function () {
      console.log(prefix + "Finished attachment %s", filename);
    });
  };
}

imap.once("ready", function () {
  console.log("IMAP connection established.");
  imap.openBox("INBOX", true, function (err, box) {
    if (err) throw err;
    imap.search(["SEEN"], function (err, results) {
      if (err) throw err;
      var f = imap.fetch(results, {
        bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", ""],
        struct: true,
      });
      f.on("message", function (msg, seqno) {
        console.log("Message #%d", seqno);
        var prefix = "(#" + seqno + ") ";
        msg.once("attributes", function (attrs) {
          var attachments = findAttachmentParts(attrs.struct);
          console.log(prefix + "Has attachments: %d", attachments.length);
          for (var i = 0, len = attachments.length; i < len; ++i) {
            var attachment = attachments[i];
            console.log(attachment);
            var f = imap.fetch(attrs.uid, {
              bodies: [attachment.partID],
              struct: true,
            });
            f.on("message", buildAttMessageFunction(attachment));
          }
        });
      });
      f.once("error", function (err) {
        console.log("Fetch error: " + err);
      });
      f.once("end", function () {
        console.log("Done fetching all messages!");
        imap.end();
      });
    });
  });
});
imap.once("error", function (err) {
  console.log("IMAP error:", err);
});

imap.once("end", function () {
  console.log("Connection ended");
});
