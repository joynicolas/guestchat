// upload.js — handles photo/video uploads to Supabase Storage (max 10MB)

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const BUCKET = 'media';

const UploadManager = {
  pendingFile: null,

  async upload(file, username, onProgress) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('file too big — max 10 MB');
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      throw new Error('only images and videos allowed');
    }

    // Unique path: username/timestamp-random.ext
    const ext = file.name.split('.').pop().toLowerCase();
    const filename = `${username}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    if (onProgress) onProgress(10);

    const { data, error } = await supabaseClient.storage
      .from(BUCKET)
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;
    if (onProgress) onProgress(100);

    const { data: urlData } = supabaseClient.storage
      .from(BUCKET)
      .getPublicUrl(filename);

    return {
      url: urlData.publicUrl,
      path: filename,
      type: file.type.startsWith('image/') ? 'image' : 'video'
    };
  },

  async delete(path) {
    const { error } = await supabaseClient.storage
      .from(BUCKET)
      .remove([path]);
    if (error) throw error;
  },

  // Extract the storage path from a public URL
  extractPath(publicUrl) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    return idx >= 0 ? publicUrl.slice(idx + marker.length) : null;
  }
};
