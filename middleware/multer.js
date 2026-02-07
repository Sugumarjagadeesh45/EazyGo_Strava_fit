const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the directory exists to prevent errors
const uploadDir = 'uploads/events';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(
            null,
            `event-${Date.now()}${path.extname(file.originalname)}`
        );
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = /png|jpg|jpeg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);

    if (ext && mime) {
        cb(null, true);
    } else {
        cb(new Error('Only images allowed (png, jpg, jpeg)'), false);
    }
};

module.exports = multer({
    storage,
    fileFilter
});
