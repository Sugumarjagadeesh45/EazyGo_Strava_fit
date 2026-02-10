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
        // Handle missing extensions (common with blobs)
        let ext = path.extname(file.originalname);
        if (!ext || ext === '.') {
            const mimeMap = {
                'image/jpeg': '.jpg',
                'image/png': '.png',
                'image/gif': '.gif',
                'image/webp': '.webp'
            };
            ext = mimeMap[file.mimetype] || '';
        }
        cb(
            null,
            `event-${Date.now()}${ext}`
        );
    }
});

const fileFilter = (req, file, cb) => {
    // Allow more image types and be more robust
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExts = /jpeg|jpg|png|gif|webp/i;

    const mimeValid = allowedMimes.includes(file.mimetype);
    const extValid = allowedExts.test(path.extname(file.originalname));

    // Allow if EITHER mimetype OR extension is valid (fixes blob upload issues)
    if (mimeValid || extValid) {
        cb(null, true);
    } else {
        cb(new Error('Only images allowed (jpeg, jpg, png, gif, webp)'), false);
    }
};

module.exports = multer({
    storage,
    fileFilter
});
