/**
 * 图片压缩工具
 * 用于在客户端压缩图片，减少网络传输负担
 */

/**
 * 压缩图片
 * @param {string} imageSrc - 原始图片的src
 * @param {number} maxWidth - 最大宽度，默认1920
 * @param {number} maxHeight - 最大高度，默认1920
 * @param {number} quality - 压缩质量，0-1之间，默认0.8
 * @returns {Promise<string>} 返回压缩后的base64图片数据
 */
async function compressImage(imageSrc, maxWidth = 1920, maxHeight = 1920, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        // 尝试设置跨域，但如果失败则继续
        try {
            // 如果是base64或相对路径，不需要设置crossOrigin
            // 只有绝对URL且不是同源时才设置crossOrigin
            if (!imageSrc.startsWith('data:') && 
                !imageSrc.startsWith('/') && 
                !imageSrc.startsWith('./') &&
                imageSrc.includes('://') &&
                !imageSrc.startsWith(window.location.protocol + '//' + window.location.host)) {
                img.crossOrigin = 'anonymous';
            }
        } catch (e) {
            // 忽略跨域设置错误
        }
        
        img.onload = function() {
            try {
                // 计算压缩后的尺寸
                let width = img.width;
                let height = img.height;
                
                // 如果图片尺寸小于最大尺寸，仍然进行轻微压缩以优化文件大小
                // 但保持原始尺寸
                const shouldResize = width > maxWidth || height > maxHeight;
                
                if (!shouldResize && width * height < 500000) {
                    // 如果图片已经很小（小于50万像素），直接返回原图
                    resolve(imageSrc);
                    return;
                }
                
                // 按比例缩放（如果需要）
                if (shouldResize) {
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }
                }
                
                // 创建canvas进行压缩
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // 使用高质量渲染
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // 绘制图片
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为base64，根据原图格式选择输出格式
                let outputFormat = 'image/jpeg';
                let outputQuality = quality;
                
                // 如果是PNG且需要保持透明度，使用PNG格式
                if (imageSrc.toLowerCase().includes('.png') && !shouldResize) {
                    outputFormat = 'image/png';
                    outputQuality = undefined; // PNG不支持quality参数
                }
                
                const compressedDataUrl = canvas.toDataURL(outputFormat, outputQuality);
                resolve(compressedDataUrl);
            } catch (error) {
                console.warn('图片压缩失败，使用原图:', error);
                resolve(imageSrc); // 压缩失败时返回原图
            }
        };
        
        img.onerror = function() {
            // 如果跨域失败，尝试不使用crossOrigin重新加载
            if (img.crossOrigin === 'anonymous') {
                const retryImg = new Image();
                retryImg.onload = function() {
                    // 递归调用，但这次不使用crossOrigin
                    compressImage(imageSrc, maxWidth, maxHeight, quality)
                        .then(resolve)
                        .catch(() => resolve(imageSrc));
                };
                retryImg.onerror = function() {
                    console.warn('图片加载失败:', imageSrc);
                    resolve(imageSrc); // 加载失败时返回原图，而不是reject
                };
                retryImg.src = imageSrc;
            } else {
                console.warn('图片加载失败:', imageSrc);
                resolve(imageSrc); // 加载失败时返回原图
            }
        };
        
        img.src = imageSrc;
    });
}

/**
 * 为图片元素应用压缩
 * @param {HTMLImageElement} imgElement - 图片元素
 * @param {Object} options - 压缩选项
 */
async function applyImageCompression(imgElement, options = {}) {
    const {
        maxWidth = 1920,
        maxHeight = 1920,
        quality = 0.8,
        showLoading = true
    } = options;
    
    // 如果图片已经有data-compressed属性，说明已经压缩过，跳过
    if (imgElement.dataset.compressed === 'true') {
        return;
    }
    
    const originalSrc = imgElement.src;
    
    // 如果是base64图片，跳过压缩
    if (originalSrc.startsWith('data:image')) {
        return;
    }
    
    // 显示加载状态
    if (showLoading) {
        imgElement.style.opacity = '0.5';
    }
    
    try {
        // 压缩图片
        const compressedSrc = await compressImage(originalSrc, maxWidth, maxHeight, quality);
        
        // 替换图片src
        imgElement.src = compressedSrc;
        imgElement.dataset.compressed = 'true';
        imgElement.dataset.originalSrc = originalSrc; // 保存原始src
        
        // 恢复透明度
        if (showLoading) {
            imgElement.style.opacity = '1';
            imgElement.style.transition = 'opacity 0.5s ease';
        }
    } catch (error) {
        console.warn('图片压缩失败，使用原图:', error);
        // 压缩失败时恢复原图
        imgElement.style.opacity = '1';
    }
}

/**
 * 为页面中所有图片应用压缩
 * @param {Object} options - 压缩选项
 */
function compressAllImages(options = {}) {
    const defaultOptions = {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
        selector: 'img' // 默认选择所有图片
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // 获取所有图片元素
    const images = document.querySelectorAll(finalOptions.selector);
    
    // 为每张图片应用压缩
    images.forEach(img => {
        // 跳过logo等小图片
        if (img.classList.contains('logo')) {
            return;
        }
        
        // 如果图片已经加载完成
        if (img.complete) {
            applyImageCompression(img, finalOptions);
        } else {
            // 等待图片加载完成后再压缩
            img.addEventListener('load', function() {
                applyImageCompression(this, finalOptions);
            }, { once: true });
        }
    });
}

/**
 * 为动态加载的图片应用压缩（用于轮播图等）
 * @param {HTMLImageElement} imgElement - 图片元素
 * @param {Object} options - 压缩选项
 */
async function compressImageForCarousel(imgElement, options = {}) {
    const {
        maxWidth = 1920,
        maxHeight = 1920,
        quality = 0.8
    } = options;
    
    await applyImageCompression(imgElement, {
        maxWidth,
        maxHeight,
        quality,
        showLoading: false
    });
}

