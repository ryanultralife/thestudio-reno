// ============================================
// CLOUDINARY IMAGE UPLOAD UTILITIES
// ============================================

// Configuration - set these in your .env
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'thestudio';

/**
 * Open Cloudinary upload widget
 * @param {Object} options - Configuration options
 * @param {Function} onSuccess - Callback with uploaded image data
 * @param {Function} onError - Error callback
 */
export function openUploadWidget(options = {}, onSuccess, onError) {
  if (!window.cloudinary) {
    console.error('Cloudinary widget not loaded');
    onError?.('Cloudinary widget not loaded');
    return;
  }

  const widget = window.cloudinary.createUploadWidget(
    {
      cloudName: CLOUDINARY_CLOUD_NAME,
      uploadPreset: CLOUDINARY_UPLOAD_PRESET,
      sources: ['local', 'url', 'camera'],
      multiple: options.multiple || false,
      maxFiles: options.maxFiles || 10,
      maxFileSize: options.maxFileSize || 10000000, // 10MB
      resourceType: 'image',
      folder: options.folder || 'thestudio',
      cropping: options.cropping !== false,
      croppingAspectRatio: options.aspectRatio || null,
      croppingShowDimensions: true,
      croppingValidateDimensions: true,
      showSkipCropButton: true,
      styles: {
        palette: {
          window: '#FFFFFF',
          windowBorder: '#8B7355',
          tabIcon: '#8B7355',
          menuIcons: '#6B5A45',
          textDark: '#3D3D3D',
          textLight: '#FFFFFF',
          link: '#8B7355',
          action: '#C9A86C',
          inactiveTabIcon: '#D4C5B5',
          error: '#DC2626',
          inProgress: '#C9A86C',
          complete: '#059669',
          sourceBg: '#FAF8F5'
        },
        fonts: {
          default: null,
          "'Lato', sans-serif": {
            url: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;500;700&display=swap',
            active: true
          }
        }
      }
    },
    (error, result) => {
      if (error) {
        console.error('Upload error:', error);
        onError?.(error);
        return;
      }
      if (result.event === 'success') {
        const imageData = {
          url: result.info.secure_url,
          publicId: result.info.public_id,
          width: result.info.width,
          height: result.info.height,
          format: result.info.format,
          bytes: result.info.bytes,
          thumbnailUrl: result.info.thumbnail_url,
          originalFilename: result.info.original_filename
        };
        onSuccess?.(imageData);
      }
    }
  );

  widget.open();
  return widget;
}

/**
 * React component for image upload button
 */
export function ImageUploadButton({ 
  onUpload, 
  folder = 'general',
  aspectRatio = null,
  multiple = false,
  className = '',
  children 
}) {
  const handleClick = () => {
    openUploadWidget(
      { folder, aspectRatio, multiple },
      (imageData) => onUpload?.(imageData),
      (error) => console.error('Upload failed:', error)
    );
  };

  return (
    <button 
      type="button"
      onClick={handleClick}
      className={className || 'px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition'}
    >
      {children || 'Upload Image'}
    </button>
  );
}

/**
 * Image URL transformation helpers
 */
export function getImageUrl(publicId, options = {}) {
  const { width, height, crop = 'fill', quality = 'auto', format = 'auto' } = options;
  
  let transforms = `f_${format},q_${quality}`;
  if (width) transforms += `,w_${width}`;
  if (height) transforms += `,h_${height}`;
  if (crop) transforms += `,c_${crop}`;
  
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transforms}/${publicId}`;
}

export function getThumbnail(publicId, size = 200) {
  return getImageUrl(publicId, { width: size, height: size, crop: 'thumb' });
}

export function getHeroImage(publicId) {
  return getImageUrl(publicId, { width: 1920, height: 800, crop: 'fill' });
}

export function getCardImage(publicId) {
  return getImageUrl(publicId, { width: 600, height: 400, crop: 'fill' });
}

export function getProfileImage(publicId, size = 300) {
  return getImageUrl(publicId, { width: size, height: size, crop: 'thumb', gravity: 'face' });
}
