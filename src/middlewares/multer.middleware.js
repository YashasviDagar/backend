import multer from "multer";

// Configure where and how uploaded files will be stored
const storage = multer.diskStorage({

    // Define the folder where uploaded files will be saved temporarily
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },

    // Define the name of the file when it is stored
    // Currently using the original file name uploaded by the user
    filename: function (req, file, cb) {

      cb(null, file.originalname)
    }
})

// Create and export multer middleware using the storage configuration
// This middleware can be used in routes to handle file uploads
export const upload = multer({
    storage,
})

/**
 * User uploads file
       │
       ▼
Multer receives file
       │
       ▼
destination() decides WHERE to save it
       │
       ▼
filename() decides WHAT NAME to save it with
       │
       ▼
File saved in ./public/temp
 */