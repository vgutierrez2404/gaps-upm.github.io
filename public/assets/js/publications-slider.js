// Publications Slider and Zoom functionality
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const totalSlides = slides.length;
const slider = document.querySelector('.publications-slider');
const sliderContainer = document.getElementById('sliderContainer');
const dotsContainer = document.getElementById('sliderDots');
let sliderInterval = null;
let totalPositions = 1;

function getSlidesPerView() {
  if (!slider) {
    return 1;
  }

  const value = parseInt(getComputedStyle(slider).getPropertyValue('--slides-per-view'), 10);
  return Number.isNaN(value) ? 1 : value;
}

function getSlideStep() {
  if (!sliderContainer || slides.length === 0) {
    return 0;
  }

  const style = getComputedStyle(sliderContainer);
  const gap = parseFloat(style.columnGap || style.gap) || 0;
  return slides[0].getBoundingClientRect().width + gap;
}

function getMaxSlideIndex() {
  return Math.max(0, totalSlides - getSlidesPerView());
}

function syncSliderControls() {
  totalPositions = getMaxSlideIndex() + 1;
  currentSlide = Math.min(currentSlide, getMaxSlideIndex());

  if (slider) {
    slider.classList.toggle('is-static', totalPositions <= 1);
  }

  if (!dotsContainer) {
    return;
  }

  dotsContainer.innerHTML = '';
  for (let i = 0; i < totalPositions; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.onclick = () => goToSlide(i);
    dotsContainer.appendChild(dot);
  }
}

function updateSlider() {
  currentSlide = Math.max(0, Math.min(currentSlide, getMaxSlideIndex()));

  if (sliderContainer) {
    sliderContainer.style.transform = `translateX(-${currentSlide * getSlideStep()}px)`;
  }
  
  // Update dots
  const dots = document.querySelectorAll('.dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentSlide);
  });
}

function moveSlide(direction) {
  currentSlide += direction;
  
  if (currentSlide < 0) {
    currentSlide = getMaxSlideIndex();
  } else if (currentSlide > getMaxSlideIndex()) {
    currentSlide = 0;
  }
  
  updateSlider();
  
  // Restart the timer when manually navigating
  startSlider();
}

function goToSlide(index) {
  currentSlide = index;
  updateSlider();
  
  // Restart the timer when manually navigating
  startSlider();
}

// Start auto-advance slider
function startSlider() {
  // Clear any existing interval
  if (sliderInterval) {
    clearInterval(sliderInterval);
  }
  if (totalPositions <= 1) {
    return;
  }

  // Auto-advance slider every 10 seconds
  sliderInterval = setInterval(() => {
    moveSlide(1);
  }, 10000);
}

// Stop slider
function stopSlider() {
  if (sliderInterval) {
    clearInterval(sliderInterval);
    sliderInterval = null;
  }
}

// Zoom functions
let isZoomed = false;
let zoomCenterX = 0.5;
let zoomCenterY = 0.5;

// The same screen-fitted baseline is used regardless of original resolution.
function fitZoomImage() {
  const image = document.getElementById('zoomedImage');
  const container = document.querySelector('.zoom-container');
  if (!image.naturalWidth || !image.naturalHeight || !container.clientWidth || !container.clientHeight) return;
  const scale = Math.min((container.clientWidth - 48) / image.naturalWidth, (container.clientHeight - 48) / image.naturalHeight);
  image.style.width = `${image.naturalWidth * scale}px`;
  image.style.height = `${image.naturalHeight * scale}px`;
  if (isZoomed) updateImagePosition(zoomCenterX, zoomCenterY);
}

document.getElementById('zoomedImage').addEventListener('load', fitZoomImage);

function openZoom(imageSrc) {
  const modal = document.getElementById('zoomModal');
  const zoomedImage = document.getElementById('zoomedImage');
  const zoomHint = document.getElementById('zoomHint');
  
  // Stop the slider when opening zoom
  stopSlider();

  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  
  zoomedImage.src = imageSrc;
  zoomedImage.classList.remove('zoomed');
  zoomedImage.style.transform = '';
  isZoomed = false;
  zoomCenterX = 0.5;
  zoomCenterY = 0.5;
  document.body.classList.add('modal-open');
  modal.classList.add('active');
  fitZoomImage();
  
  // Show hint for 3 seconds
  zoomHint.style.opacity = '1';
  setTimeout(() => {
    zoomHint.style.opacity = '0';
  }, 3000);
}

function closeZoom() {
  const modal = document.getElementById('zoomModal');
  const zoomedImage = document.getElementById('zoomedImage');
  
  modal.classList.remove('active');
  zoomedImage.classList.remove('zoomed');
  zoomedImage.style.transform = '';
  isZoomed = false;
  document.body.classList.remove('modal-open');
  
  // Remove mouse move listener
  zoomedImage.removeEventListener('mousemove', handleMouseMove);
  
  // Resume the slider when closing zoom
  startSlider();
}

function toggleZoomLevel(event) {
  event.stopPropagation();
  const zoomedImage = document.getElementById('zoomedImage');
  const zoomHint = document.getElementById('zoomHint');
  
  if (isZoomed) {
    // Already zoomed in, close the modal
    closeZoom();
  } else {
    // Calculate where the user clicked on the image (0-1 range)
    const rect = zoomedImage.getBoundingClientRect();
    zoomCenterX = (event.clientX - rect.left) / rect.width;
    zoomCenterY = (event.clientY - rect.top) / rect.height;
    
    // Clamp values between 0 and 1
    zoomCenterX = Math.max(0, Math.min(1, zoomCenterX));
    zoomCenterY = Math.max(0, Math.min(1, zoomCenterY));
    
    // Zoom in and enable panning
    zoomedImage.classList.add('zoomed');
    isZoomed = true;
    
    // Center on click position
    updateImagePosition(zoomCenterX, zoomCenterY);
    
    // Add mouse move listener for panning
    zoomedImage.addEventListener('mousemove', handleMouseMove);
    
    zoomHint.textContent = 'Move mouse to pan • Click to close • ESC to close';
    zoomHint.style.opacity = '1';
    setTimeout(() => {
      zoomHint.style.opacity = '0';
    }, 3000);
  }
}

function handleMouseMove(event) {
  const zoomedImage = document.getElementById('zoomedImage');
  
  if (!isZoomed) return;
  
  // Get mouse position relative to the viewport
  const container = document.getElementById('zoomModal');
  const containerRect = container.getBoundingClientRect();
  
  // Normalize mouse position (0 to 1)
  const mouseX = (event.clientX - containerRect.left) / containerRect.width;
  const mouseY = (event.clientY - containerRect.top) / containerRect.height;
  
  updateImagePosition(mouseX, mouseY);
}

function updateImagePosition(mouseX, mouseY) {
  const image = document.getElementById('zoomedImage');
  const container = document.querySelector('.zoom-container');
  zoomCenterX = mouseX;
  zoomCenterY = mouseY;
  const zoomScale = 1.4;
  const overflowX = Math.max(0, image.clientWidth * zoomScale - (container.clientWidth - 48));
  const overflowY = Math.max(0, image.clientHeight * zoomScale - (container.clientHeight - 48));
  const translateX = (0.5 - mouseX) * overflowX;
  const translateY = (0.5 - mouseY) * overflowY;
  image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomScale})`;
}

// Click on modal background to close
document.getElementById('zoomModal').addEventListener('click', function(event) {
  if (event.target === this || event.target.classList.contains('zoom-container')) {
    closeZoom();
  }
});

// Navigate to publication
function goToPublication(link) {
  if (link) {
    window.location.href = link;
  }
}

// Close zoom on Escape key
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeZoom();
  }
});

// Initialize slider
syncSliderControls();
updateSlider();
startSlider();

window.addEventListener('resize', function() {
  fitZoomImage();
  syncSliderControls();
  updateSlider();
});
