import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

const sendEmail = async (to, subject, templateFile, replacements) => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "emailTemplates",
      templateFile
    );
    let emailHtml = fs.readFileSync(templatePath, "utf-8");

    Object.keys(replacements).forEach((key) => {
      emailHtml = emailHtml.replace(
        new RegExp(`\\$\\{${key}\\}`, "g"),
        replacements[key]
      );
    });

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"MedQueue" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: emailHtml,
    });

    console.log("Email sent");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

export default sendEmail;
