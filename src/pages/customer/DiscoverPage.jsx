import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { discover as discoverApi, feedback as feedbackApi } from '../../lib/supabase'
import { formatCurrency } from '../../utils/helpers'
import Icon from '../../components/ui/Icon'
import { Spinner, Empty, SectionHead } from '../../components/ui/Primitives'
import { FeedbackForm } from '../../components/ui/FeedbackForm'

// ── DISCOVER PAGE ────────────────────────────────────────────────
export function CustomerDiscover() {
  const navigate = useNavigate()
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    city: '',
    area: '',
    minRating: 0,
    sortBy: 'rating',
    tags: []
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    searchShops()
  }, [])

  const searchShops = async () => {
    setLoading(true)
    const { data, error } = await discoverApi.searchShops(searchQuery, filters)
    if (!error && data) {
      setShops(data)
    }
    setLoading(false)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    searchShops()
  }

  const clearFilters = () => {
    setFilters({ city: '', area: '', minRating: 0, sortBy: 'rating', tags: [] })
    setSearchQuery('')
  }

  return (
    <div className="page-inner">
      {/* Search Bar */}
      <div className="discover-search-container">
        <form onSubmit={handleSearch} className="discover-search-form">
          <div className="discover-search-input-wrapper">
            <Icon name="search" size={18} color="var(--text-tertiary)" />
            <input
              type="text"
              className="discover-search-input"
              placeholder="Search shops by name, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="discover-search-clear"
                onClick={() => setSearchQuery('')}
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
            className={`discover-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Icon name="filter" size={18} />
            <span>Filters</span>
          </button>
        </form>

        {/* Filters Panel */}
        {showFilters && (
          <div className="discover-filters-panel">
            <div className="discover-filters-grid">
              <div className="form-field">
                <label className="form-label">Sort By</label>
                <select
                  className="form-input"
                  value={filters.sortBy}
                  onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value }))}
                >
                  <option value="rating">Highest Rated</option>
                  <option value="reviews">Most Reviews</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Min Rating</label>
                <select
                  className="form-input"
                  value={filters.minRating}
                  onChange={(e) => setFilters(f => ({ ...f, minRating: Number(e.target.value) }))}
                >
                  <option value="0">All Ratings</option>
                  <option value="4">4+ Stars</option>
                  <option value="4.5">4.5+ Stars</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">City</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Chennai"
                  value={filters.city}
                  onChange={(e) => setFilters(f => ({ ...f, city: e.target.value }))}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Area</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Anna Nagar"
                  value={filters.area}
                  onChange={(e) => setFilters(f => ({ ...f, area: e.target.value }))}
                />
              </div>
            </div>

            {/* Tags Filter */}
            <div className="form-field" style={{ marginTop: 16 }}>
              <label className="form-label">Tags</label>
              <div className="discover-tags-filter">
                {['Premium', 'Budget-Friendly', 'Kids-Friendly', 'Beard-Specialist', 'Quick-Service', 'Walk-In-Welcome'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className={`discover-tag-btn ${filters.tags.includes(tag) ? 'active' : ''}`}
                    onClick={() => {
                      setFilters(f => ({
                        ...f,
                        tags: f.tags.includes(tag)
                          ? f.tags.filter(t => t !== tag)
                          : [...f.tags, tag]
                      }))
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="discover-filters-actions">
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                Clear All
              </button>
              <button className="btn btn-gold btn-sm" onClick={searchShops}>
                <Icon name="search" size={14} />
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <Spinner page />
        </div>
      ) : shops.length === 0 ? (
        <Empty
          icon="search"
          title="No shops found"
          sub="Try adjusting your search or filters"
        />
      ) : (
        <>
          <div className="discover-results-header">
            <span className="discover-results-count">
              {shops.length} {shops.length === 1 ? 'shop' : 'shops'} found
            </span>
          </div>

          <div className="discover-grid">
            {shops.map(shop => (
              <ShopCard key={shop.id} shop={shop} onClick={() => navigate(`/app/discover/${shop.id}`)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── SHOP CARD ────────────────────────────────────────────────────
function ShopCard({ shop, onClick }) {
  const coverImage = shop.cover_image || shop.shop_images?.[0]?.image_url
  const amenities = shop.shop_amenities?.slice(0, 3) || []

  return (
    <div className="discover-shop-card" onClick={onClick}>
      {/* Cover Image */}
      <div className="discover-shop-cover">
        {coverImage ? (
          <img src={coverImage} alt={shop.name} />
        ) : (
          <div className="discover-shop-cover-placeholder">
            <Icon name="store" size={32} color="var(--text-disabled)" />
          </div>
        )}
        {shop.avg_rating > 0 && (
          <div className="discover-shop-rating-badge">
            <Icon name="star" size={12} color="var(--gold)" />
            <span>{shop.avg_rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="discover-shop-content">
        <h3 className="discover-shop-name">{shop.name}</h3>
        
        {shop.description && (
          <p className="discover-shop-description">
            {shop.description.length > 80 
              ? shop.description.substring(0, 80) + '...' 
              : shop.description}
          </p>
        )}

        <div className="discover-shop-meta">
          <div className="discover-shop-meta-item">
            <Icon name="mapPin" size={14} color="var(--text-tertiary)" />
            <span>{shop.area || shop.address}</span>
          </div>
          {shop.feedback_count > 0 && (
            <div className="discover-shop-meta-item">
              <Icon name="users" size={14} color="var(--text-tertiary)" />
              <span>{shop.feedback_count} reviews</span>
            </div>
          )}
        </div>

        {/* Amenities */}
        {amenities.length > 0 && (
          <div className="discover-shop-amenities">
            {amenities.map((a, i) => (
              <span key={i} className="discover-shop-amenity">
                {getAmenityLabel(a.amenity)}
              </span>
            ))}
            {shop.shop_amenities?.length > 3 && (
              <span className="discover-shop-amenity">
                +{shop.shop_amenities.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── SHOP DETAILS PAGE ────────────────────────────────────────────
export function ShopDetails({ shopId: propShopId }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { toast } = useToast()
  const shopId = propShopId || window.location.pathname.split('/').pop()
  
  const [shop, setShop] = useState(null)
  const [feedback, setFeedback] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)

  useEffect(() => {
    loadShopData()
  }, [shopId])

  const loadShopData = async () => {
    setLoading(true)
    
    const [shopRes, feedbackRes, statsRes] = await Promise.all([
      discoverApi.getShopDetails(shopId),
      feedbackApi.getByShop(shopId),
      discoverApi.getShopStats(shopId)
    ])

    if (!shopRes.error && shopRes.data) setShop(shopRes.data)
    if (!feedbackRes.error && feedbackRes.data) setFeedback(feedbackRes.data)
    if (statsRes) setStats(statsRes)
    
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="page-inner">
        <Spinner page />
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="page-inner">
        <Empty icon="store" title="Shop not found" />
      </div>
    )
  }

  return (
    <div className="page-inner">
      {/* Header */}
      <div className="discover-detail-header">
        <button className="btn-icon" onClick={() => navigate('/app/discover')}>
          <Icon name="chevLeft" size={18} />
        </button>
        <h1 className="discover-detail-title">{shop.name}</h1>
      </div>

      {/* Cover & Gallery */}
      <ShopGallery shop={shop} />

      {/* Tabs */}
      <div className="discover-tabs">
        {['overview', 'services', 'reviews'].map(tab => (
          <button
            key={tab}
            className={`discover-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <ShopOverview shop={shop} stats={stats} />
      )}
      
      {activeTab === 'services' && (
        <ShopServices shop={shop} />
      )}
      
      {activeTab === 'reviews' && (
        <ShopReviews 
          shop={shop} 
          feedback={feedback} 
          stats={stats}
          onAddReview={() => setShowFeedbackForm(true)}
          onReviewAdded={loadShopData}
        />
      )}

      {/* Feedback Form Modal */}
      {showFeedbackForm && (
        <FeedbackForm
          shopId={shopId}
          onClose={() => setShowFeedbackForm(false)}
          onSubmit={() => {
            setShowFeedbackForm(false)
            loadShopData()
            toast('Feedback submitted successfully', 'success')
          }}
        />
      )}

      {/* Book Button */}
      <div className="discover-detail-footer">
        <button 
          className="btn btn-gold btn-lg btn-full"
          onClick={() => navigate('/app/book')}
        >
          <Icon name="calendar" size={18} />
          Book Appointment
        </button>
      </div>
    </div>
  )
}

// Helper function for amenity labels
function getAmenityLabel(amenity) {
  const labels = {
    wifi: 'WiFi',
    parking: 'Parking',
    ac: 'AC',
    card_payment: 'Card',
    upi_payment: 'UPI',
    waiting_area: 'Waiting Area',
    wheelchair_accessible: 'Accessible'
  }
  return labels[amenity] || amenity
}

// Sub-components will be in next file...


// ── SHOP GALLERY ─────────────────────────────────────────────────
function ShopGallery({ shop }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const images = shop.shop_images || []
  const hasImages = images.length > 0

  if (!hasImages && !shop.cover_image) {
    return (
      <div className="discover-gallery-placeholder">
        <Icon name="image" size={48} color="var(--text-disabled)" />
      </div>
    )
  }

  const displayImages = hasImages 
    ? images.map(img => img.image_url)
    : [shop.cover_image]

  return (
    <div className="discover-gallery">
      <div className="discover-gallery-main">
        <img src={displayImages[currentIndex]} alt={shop.name} />
        
        {displayImages.length > 1 && (
          <>
            <button
              className="discover-gallery-nav discover-gallery-nav-prev"
              onClick={() => setCurrentIndex(i => i === 0 ? displayImages.length - 1 : i - 1)}
            >
              <Icon name="chevLeft" size={20} />
            </button>
            <button
              className="discover-gallery-nav discover-gallery-nav-next"
              onClick={() => setCurrentIndex(i => i === displayImages.length - 1 ? 0 : i + 1)}
            >
              <Icon name="chevRight" size={20} />
            </button>
          </>
        )}
      </div>

      {displayImages.length > 1 && (
        <div className="discover-gallery-thumbs">
          {displayImages.map((img, i) => (
            <button
              key={i}
              className={`discover-gallery-thumb ${i === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(i)}
            >
              <img src={img} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SHOP OVERVIEW ────────────────────────────────────────────────
function ShopOverview({ shop, stats }) {
  const amenities = shop.shop_amenities || []

  return (
    <div className="discover-overview">
      {/* Rating Summary */}
      {stats && stats.totalReviews > 0 && (
        <div className="discover-rating-summary">
          <div className="discover-rating-score">
            <div className="discover-rating-number">{stats.avgRating.toFixed(1)}</div>
            <div className="discover-rating-stars">
              {[1, 2, 3, 4, 5].map(star => (
                <Icon
                  key={star}
                  name="star"
                  size={16}
                  color={star <= Math.round(stats.avgRating) ? 'var(--gold)' : 'var(--text-disabled)'}
                />
              ))}
            </div>
            <div className="discover-rating-count">{stats.totalReviews} reviews</div>
          </div>

          <div className="discover-rating-bars">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = stats.ratingDistribution[rating] || 0
              const percentage = stats.totalReviews > 0 
                ? (count / stats.totalReviews) * 100 
                : 0

              return (
                <div key={rating} className="discover-rating-bar-row">
                  <span className="discover-rating-bar-label">{rating}</span>
                  <Icon name="star" size={12} color="var(--gold)" />
                  <div className="discover-rating-bar">
                    <div 
                      className="discover-rating-bar-fill" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="discover-rating-bar-count">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Description */}
      {shop.description && (
        <div className="discover-section">
          <h3 className="discover-section-title">About</h3>
          <p className="discover-section-text">{shop.description}</p>
        </div>
      )}

      {/* Info */}
      <div className="discover-section">
        <h3 className="discover-section-title">Information</h3>
        <div className="discover-info-grid">
          <div className="discover-info-item">
            <Icon name="mapPin" size={18} color="var(--gold)" />
            <div>
              <div className="discover-info-label">Address</div>
              <div className="discover-info-value">{shop.address}</div>
              {shop.area && <div className="discover-info-sub">{shop.area}, {shop.city}</div>}
            </div>
          </div>

          {shop.phone && (
            <div className="discover-info-item">
              <Icon name="phone" size={18} color="var(--gold)" />
              <div>
                <div className="discover-info-label">Phone</div>
                <div className="discover-info-value">{shop.phone}</div>
              </div>
            </div>
          )}

          <div className="discover-info-item">
            <Icon name="clock" size={18} color="var(--gold)" />
            <div>
              <div className="discover-info-label">Hours</div>
              <div className="discover-info-value">
                {shop.opening_time?.substring(0, 5)} - {shop.closing_time?.substring(0, 5)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Amenities */}
      {amenities.length > 0 && (
        <div className="discover-section">
          <h3 className="discover-section-title">Amenities</h3>
          <div className="discover-amenities-grid">
            {amenities.map((a, i) => (
              <div key={i} className="discover-amenity-item">
                <Icon name={getAmenityIcon(a.amenity)} size={18} color="var(--gold)" />
                <span>{getAmenityLabel(a.amenity)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── SHOP SERVICES ────────────────────────────────────────────────
function ShopServices({ shop }) {
  const services = shop.services || []

  if (services.length === 0) {
    return (
      <div className="discover-section">
        <Empty icon="scissors" title="No services listed" sub="Services will appear here once added by the shop" />
      </div>
    )
  }

  return (
    <div className="discover-section">
      <div className="discover-services-list">
        {services.map(service => (
          <div key={service.id} className="discover-service-item">
            <div className="discover-service-info">
              <h4 className="discover-service-name">{service.name}</h4>
              {service.description && (
                <p className="discover-service-description">{service.description}</p>
              )}
              <div className="discover-service-meta">
                <span className="discover-service-duration">
                  <Icon name="clock" size={14} />
                  {service.duration} min
                </span>
              </div>
            </div>
            <div className="discover-service-price">
              {formatCurrency(service.price)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SHOP REVIEWS ─────────────────────────────────────────────────
function ShopReviews({ shop, feedback, stats, onAddReview, onReviewAdded }) {
  const { profile } = useAuth()
  const [sortBy, setSortBy] = useState('recent')

  const sortedFeedback = [...feedback].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.created_at) - new Date(a.created_at)
    } else if (sortBy === 'rating') {
      return b.rating - a.rating
    } else if (sortBy === 'helpful') {
      return b.helpful_count - a.helpful_count
    }
    return 0
  })

  return (
    <div className="discover-section">
      {/* Header */}
      <div className="discover-reviews-header">
        <div>
          <h3 className="discover-section-title">Customer Reviews</h3>
          <p className="discover-section-subtitle">{feedback.length} reviews</p>
        </div>
        <button className="btn btn-gold btn-sm" onClick={onAddReview}>
          <Icon name="edit" size={14} />
          Write Review
        </button>
      </div>

      {/* Sort */}
      <div className="discover-reviews-sort">
        <select
          className="form-input form-input-sm"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="recent">Most Recent</option>
          <option value="rating">Highest Rating</option>
          <option value="helpful">Most Helpful</option>
        </select>
      </div>

      {/* List */}
      {sortedFeedback.length === 0 ? (
        <Empty icon="star" title="No reviews yet" sub="Be the first to review this shop" />
      ) : (
        <div className="discover-reviews-list">
          {sortedFeedback.map(item => (
            <FeedbackItem key={item.id} feedback={item} onUpdate={onReviewAdded} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── FEEDBACK ITEM ────────────────────────────────────────────────
function FeedbackItem({ feedback, onUpdate }) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [isHelpful, setIsHelpful] = useState(false)
  const [helpfulCount, setHelpfulCount] = useState(feedback.helpful_count || 0)

  useEffect(() => {
    if (profile?.id) {
      feedbackApi.isHelpful(feedback.id, profile.id).then(setIsHelpful)
    }
  }, [feedback.id, profile?.id])

  const toggleHelpful = async () => {
    if (!profile) {
      toast('Please login to mark as helpful', 'error')
      return
    }

    if (isHelpful) {
      await feedbackApi.unmarkHelpful(feedback.id, profile.id)
      setIsHelpful(false)
      setHelpfulCount(c => c - 1)
    } else {
      await feedbackApi.markHelpful(feedback.id, profile.id)
      setIsHelpful(true)
      setHelpfulCount(c => c + 1)
    }
  }

  const images = feedback.images || []

  return (
    <div className="discover-review-item">
      <div className="discover-review-header">
        <div className="discover-review-user">
          <div className="avatar avatar-md av-gold">
            {feedback.profiles?.initials || 'U'}
          </div>
          <div>
            <div className="discover-review-user-name">
              {feedback.profiles?.name || 'Anonymous'}
            </div>
            <div className="discover-review-date">
              {new Date(feedback.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </div>
          </div>
        </div>

        <div className="discover-review-rating">
          {[1, 2, 3, 4, 5].map(star => (
            <Icon
              key={star}
              name="star"
              size={14}
              color={star <= feedback.rating ? 'var(--gold)' : 'var(--text-disabled)'}
            />
          ))}
        </div>
      </div>

      {feedback.title && (
        <h4 className="discover-review-title">{feedback.title}</h4>
      )}

      <p className="discover-review-comment">{feedback.comment}</p>

      {/* Images */}
      {images.length > 0 && (
        <div className="discover-review-images">
          {images.map((img, i) => (
            <div key={i} className="discover-review-image">
              <img 
                src={img} 
                alt={`Review image ${i + 1}`}
                onError={(e) => {
                  console.error('Image failed to load:', img)
                  e.target.style.display = 'none'
                }}
                onLoad={() => console.log('Image loaded:', img)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="discover-review-actions">
        <button
          className={`discover-review-action-btn ${isHelpful ? 'active' : ''}`}
          onClick={toggleHelpful}
        >
          <Icon name="thumbsUp" size={14} />
          <span>Helpful ({helpfulCount})</span>
        </button>
      </div>
    </div>
  )
}

// Helper functions
function getAmenityIcon(amenity) {
  const icons = {
    wifi: 'wifi',
    parking: 'mapPin',
    ac: 'wind',
    card_payment: 'creditCard',
    upi_payment: 'smartphone',
    waiting_area: 'users',
    wheelchair_accessible: 'accessibility'
  }
  return icons[amenity] || 'check'
}
