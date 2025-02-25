const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "Union Apparel",
    allowedFormats: ["jpeg", "png", "jpg"],
    public_id: (req, file) => `${Date.now()}-${file.originalname}`,
    transformation: [{ quality: "auto" }],
  },
});

module.exports = {
  cloudinary,
  storage,
};
