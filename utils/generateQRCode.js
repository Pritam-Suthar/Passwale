const QRCode = require("qrcode");

const generateQRCode = async (text) => {
    try {
        return await QRCode.toDataURL(text);
    } catch (err) {
        console.error("QR Code Generation Error:", err);
        return null;
    }
};

module.exports = generateQRCode;
