const fs = require("fs-extra");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const PDFDocument = require("pdfkit");

// 🎨 Define badge colors based on role
const roleColors = {
    user: "#4CAF50",       // Green
    volunteer: "#2196F3",  // Blue
    organizer: "#F44336",  // Red
};

// 🛠️ Define badge save paths
const badgePaths = {
    user: "/badges/users/",
    volunteer: "/badges/volunteers/",
    organizer: "/badges/organizers/",
};

async function generateBadge(user, event, ticket = null) {
    const width = 600, height = 300; // Badge size
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 🎨 Background (Different color based on role)
    const userRole = user.role || "user"; // Default to "user" if role is missing
    const badgeColor = roleColors[userRole] || "#000"; // Default black
    ctx.fillStyle = badgeColor;
    ctx.fillRect(0, 0, width, height);

    // 🏷️ Header
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px Arial";
    ctx.fillText(`${userRole.toUpperCase()} BADGE`, 20, 35);

    // 👤 User Info
    ctx.fillStyle = "#000";
    ctx.font = "bold 22px Arial";
    ctx.fillText(user.name, 20, 90);
    ctx.font = "16px Arial";
    ctx.fillText(`Event: ${event.name}`, 20, 120);

    if (ticket) {
        ctx.fillText(`Ticket Type: ${ticket.ticketType}`, 20, 150);
    } else {
        ctx.fillText("Access: Full Event", 20, 150);
    }

    ctx.fillText(`Date: ${new Date(event.datetime).toDateString()}`, 20, 180);

    // 🖼️ QR Code (Only for users with tickets)
    if (ticket && ticket.qrCode) {
        const qrPath = path.join(__dirname, `../public${ticket.qrCode}`);
        const qrImage = await loadImage(qrPath);
        ctx.drawImage(qrImage, 450, 80, 120, 120);
    }

    // 📌 Save badge in role-specific folder
    const roleBadgePath = badgePaths[userRole] || "/badges/others/";
    const badgeFileName = `${user._id}_${event._id}.png`;
    const badgePath = `${roleBadgePath}${badgeFileName}`;
    const badgeFullPath = path.join(__dirname, `../public${badgePath}`);
    await fs.ensureDir(path.dirname(badgeFullPath));

    const out = fs.createWriteStream(badgeFullPath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);

    return new Promise((resolve, reject) => {
        out.on("finish", () => resolve(badgePath));
        out.on("error", reject);
    });
}

// 📄 Generate Badge PDF
const generateBadgePDF = async (badgePath, userId, eventId, role) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Define PDF path based on role
            const pdfPaths = {
                user: "/badges-pdf/users/",
                volunteer: "/badges-pdf/volunteers/",
                organizer: "/badges-pdf/organizers/",
            };
            const rolePdfPath = pdfPaths[role] || "/badges-pdf/others/";

            const pdfFileName = `${userId}_${eventId}.pdf`;
            const pdfPath = path.join(__dirname, `../public${rolePdfPath}${pdfFileName}`);

            // Ensure the directory exists
            await fs.ensureDir(path.dirname(pdfPath));

            const doc = new PDFDocument();
            const writeStream = fs.createWriteStream(pdfPath);
            doc.pipe(writeStream);

            // Add Badge Image to PDF
            const badgeImagePath = path.join(__dirname, `../public${badgePath}`);
            const badgeImage = await loadImage(badgeImagePath);
            doc.image(badgeImage.src, 50, 50, { width: 300 });

            doc.end();

            writeStream.on("finish", () => resolve(`${rolePdfPath}${pdfFileName}`));
            writeStream.on("error", (err) => reject(err));

        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { generateBadge, generateBadgePDF };
