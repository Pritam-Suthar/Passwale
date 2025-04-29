const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage
const uploadDir = path.join(__dirname, '../public/event_images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `event-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Configure upload middleware
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  }
});

module.exports = upload;