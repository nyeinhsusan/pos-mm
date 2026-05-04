const Product = require('../models/Product');

/**
 * Get all products with optional filters
 * GET /api/products?category=Beverage&low_stock=true&search=coca&include_promotions=true
 */
exports.getAllProducts = async (req, res) => {
  try {
    const { category, low_stock, search, include_promotions } = req.query;
    const filters = { category, low_stock, search };

    // If include_promotions is true, fetch products with active promotions applied
    let products;
    if (include_promotions === 'true' || include_promotions === true) {
      products = await Product.findAllWithPromotions(filters);
    } else {
      products = await Product.findAll(filters);
    }

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve products',
        details: error.message
      }
    });
  }
};

/**
 * Get single product by ID
 * GET /api/products/:id
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve product',
        details: error.message
      }
    });
  }
};

/**
 * Create new product (Owner only)
 * POST /api/products
 */
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      price,
      cost_price,
      stock_quantity,
      low_stock_threshold,
      sku,
      description,
      last_restock_date,
      restock_frequency,
      image
    } = req.body;

    // Validation
    if (!name || !price || !cost_price) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          details: 'name, price, and cost_price are required'
        }
      });
    }

    if (price < 0 || cost_price < 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid price values',
          details: 'price and cost_price must be non-negative'
        }
      });
    }

    if (stock_quantity !== undefined && stock_quantity < 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid stock quantity',
          details: 'stock_quantity must be non-negative'
        }
      });
    }

    const productData = {
      name,
      category,
      price,
      cost_price,
      stock_quantity,
      low_stock_threshold,
      sku,
      description,
      last_restock_date,
      restock_frequency,
      image
    };

    const productId = await Product.create(productData);

    // Fetch the created product
    const newProduct = await Product.findById(productId);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct
    });
  } catch (error) {
    console.error('Create product error:', error);

    if (error.code === 'DUPLICATE_SKU') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'SKU already exists',
          details: 'Please use a unique SKU'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create product',
        details: error.message
      }
    });
  }
};

/**
 * Update product (Owner only)
 * PUT /api/products/:id
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found'
        }
      });
    }

    // Validation
    if (updateData.price !== undefined && updateData.price < 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid price',
          details: 'price must be non-negative'
        }
      });
    }

    if (updateData.cost_price !== undefined && updateData.cost_price < 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid cost price',
          details: 'cost_price must be non-negative'
        }
      });
    }

    if (
      updateData.stock_quantity !== undefined &&
      updateData.stock_quantity < 0
    ) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid stock quantity',
          details: 'stock_quantity must be non-negative'
        }
      });
    }

    const affectedRows = await Product.update(id, updateData);

    if (affectedRows === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No changes made',
          details: 'No valid fields provided for update'
        }
      });
    }

    // Fetch updated product
    const updatedProduct = await Product.findById(id);

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);

    if (error.code === 'DUPLICATE_SKU') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'SKU already exists',
          details: 'Please use a unique SKU'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update product',
        details: error.message
      }
    });
  }
};

/**
 * Delete product (Owner only)
 * DELETE /api/products/:id
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found'
        }
      });
    }

    const affectedRows = await Product.delete(id);

    if (affectedRows === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Failed to delete product'
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        product_id: parseInt(id)
      }
    });
  } catch (error) {
    console.error('Delete product error:', error);

    if (error.code === 'HAS_SALES_HISTORY') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Cannot delete product',
          details: 'This product has existing sales history'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete product',
        details: error.message
      }
    });
  }
};

/**
 * Get all product categories
 * GET /api/products/categories
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.getCategories();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve categories',
        details: error.message
      }
    });
  }
};

/**
 * Upload product image
 * POST /api/products/upload
 * Uses multer middleware - this function handles the uploaded file
 */
exports.uploadProductImage = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No file uploaded',
          details: 'Please upload an image file'
        }
      });
    }

    // Construct the image URL path
    // The file is saved at /uploads/products/filename.ext
    const imageUrl = `/uploads/products/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        imageUrl: imageUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to upload image',
        details: error.message
      }
    });
  }
};
