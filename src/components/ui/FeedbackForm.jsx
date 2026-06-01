import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { feedback as feedbackApi, storage } from '../../lib/supabase'
import Icon from './Icon'
import { Modal, Spinner } from './Primitives'

export function FeedbackForm({ shopId, onClose, onSubmit }) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [form, setForm] = useState({
    rating: 0,
    title: '',
    comment: '',
    images: []
  })
  const [hoverRating, setHoverRating] = useState(0)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.rating === 0) {
      toast('Please select a rating', 'error')
      return
    }

    if (!form.comment.trim()) {
      toast('Please write a comment', 'error')
      return
    }

    setLoading(true)

    const { error } = await feedbackApi.create({
      shop_id: shopId,
      user_id: profile.id,
      rating: form.rating,
      title: form.title.trim() || null,
      comment: form.comment.trim(),
      images: form.images
    })

    setLoading(false)

    if (error) {
      toast(error.message || 'Failed to submit feedback', 'error')
    } else {
      onSubmit()
    }
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    
    if (files.length === 0) return
    
    // Validate file count
    if (form.images.length + files.length > 5) {
      toast('You can only upload up to 5 images', 'error')
      return
    }

    // Validate file sizes (max 5MB per file)
    const maxSize = 5 * 1024 * 1024 // 5MB
    const oversizedFiles = files.filter(f => f.size > maxSize)
    if (oversizedFiles.length > 0) {
      toast('Each image must be less than 5MB', 'error')
      return
    }

    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const invalidFiles = files.filter(f => !validTypes.includes(f.type))
    if (invalidFiles.length > 0) {
      toast('Only JPG, PNG, and WebP images are allowed', 'error')
      return
    }

    setUploadingImages(true)

    try {
      // Upload images to Supabase Storage
      const { data: urls, error } = await storage.uploadImages(
        files, 
        'feedback-images', 
        `shop-${shopId}`
      )

      if (error) throw error

      // Add URLs to form
      setForm(f => ({ ...f, images: [...f.images, ...urls] }))
      toast('Images uploaded successfully', 'success')
    } catch (error) {
      console.error('Image upload error:', error)
      toast('Failed to upload images. Please try again.', 'error')
    } finally {
      setUploadingImages(false)
    }
  }

  const removeImage = (index) => {
    setForm(f => ({
      ...f,
      images: f.images.filter((_, i) => i !== index)
    }))
  }

  return (
    <Modal title="Write a Review" onClose={onClose} maxWidth={540}>
      <form onSubmit={handleSubmit}>
        {/* Rating */}
        <div className="form-field">
          <label className="form-label">Rating *</label>
          <div className="feedback-rating-input">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                className="feedback-star-btn"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setForm(f => ({ ...f, rating: star }))}
              >
                <Icon
                  name="star"
                  size={32}
                  color={
                    star <= (hoverRating || form.rating)
                      ? 'var(--gold)'
                      : 'var(--text-disabled)'
                  }
                />
              </button>
            ))}
          </div>
          {form.rating > 0 && (
            <div className="feedback-rating-label">
              {getRatingLabel(form.rating)}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="form-field">
          <label className="form-label">Title (Optional)</label>
          <input
            type="text"
            className="form-input"
            placeholder="Summarize your experience"
            value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            maxLength={100}
          />
        </div>

        {/* Comment */}
        <div className="form-field">
          <label className="form-label">Your Review *</label>
          <textarea
            className="form-input"
            rows={5}
            placeholder="Share your experience with this shop..."
            value={form.comment}
            onChange={(e) => setForm(f => ({ ...f, comment: e.target.value }))}
            maxLength={1000}
            required
          />
          <div className="form-hint">
            {form.comment.length}/1000 characters
          </div>
        </div>

        {/* Images */}
        <div className="form-field">
          <label className="form-label">Photos (Optional)</label>
          <div className="feedback-images-upload">
            {form.images.map((img, i) => (
              <div key={i} className="feedback-image-preview">
                <img src={img} alt="" />
                <button
                  type="button"
                  className="feedback-image-remove"
                  onClick={() => removeImage(i)}
                  disabled={uploadingImages}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            
            {form.images.length < 5 && (
              <label className={`feedback-image-add ${uploadingImages ? 'uploading' : ''}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploadingImages}
                  style={{ display: 'none' }}
                />
                {uploadingImages ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Icon name="image" size={24} color="var(--text-tertiary)" />
                    <span>Add Photo</span>
                  </>
                )}
              </label>
            )}
          </div>
          <div className="form-hint">
            You can upload up to 5 photos (JPG, PNG, WebP, max 5MB each)
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            className="btn btn-ghost flex-1"
            onClick={onClose}
            disabled={loading || uploadingImages}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-gold flex-1"
            disabled={loading || uploadingImages || form.rating === 0 || !form.comment.trim()}
          >
            {loading ? <Spinner /> : <Icon name="check" size={16} />}
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function getRatingLabel(rating) {
  const labels = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  }
  return labels[rating] || ''
}
