export const brands = [
  { id: "brand-luna", name: "Luna Atelier", active: true },
  { id: "brand-koko", name: "Koko Gel", active: true },
  { id: "brand-mira", name: "Mira Tools", active: true },
];

export const productCategories = [
  { id: "cat-gel", name: "Gel Nail", parentId: null, active: true },
  { id: "cat-color-gel", name: "Color Gel", parentId: "cat-gel", active: true },
  { id: "cat-care", name: "Care Product", parentId: null, active: true },
  { id: "cat-tools", name: "Equipment", parentId: null, active: true },
  { id: "cat-designs", name: "Nail Book", parentId: null, active: true },
];

export const products = [
  {
    id: "prod-magnet-01",
    name: "Autumn Magnet Gel Series",
    slug: "autumn-magnet-gel-series",
    shortDescription: "Soft reflective gel colors for premium salon art.",
    productType: "Color Gel",
    categoryId: "cat-color-gel",
    brandId: "brand-koko",
    status: "ACTIVE",
    sku: "KOKO-MG-AUT",
    basePrice: 4800,
    salePrice: 4200,
    costPrice: 1350,
    taxRate: 0.1,
    featured: true,
    onlineStoreEnabled: true,
    posEnabled: true,
    trackInventory: true,
    lowStockThreshold: 5,
  },
  {
    id: "prod-cuticle-oil",
    name: "Hinoki Cuticle Oil",
    slug: "hinoki-cuticle-oil",
    shortDescription: "Lightweight oil with a refined hinoki scent.",
    productType: "Care Product",
    categoryId: "cat-care",
    brandId: "brand-luna",
    status: "ACTIVE",
    sku: "LUNA-OIL-HINOKI",
    basePrice: 1800,
    salePrice: null,
    costPrice: 520,
    taxRate: 0.1,
    featured: true,
    onlineStoreEnabled: true,
    posEnabled: true,
    trackInventory: true,
    lowStockThreshold: 8,
  },
  {
    id: "prod-led-lamp",
    name: "Compact Pro LED Lamp",
    slug: "compact-pro-led-lamp",
    shortDescription: "Desk-friendly curing lamp for salon and retail clients.",
    productType: "Equipment",
    categoryId: "cat-tools",
    brandId: "brand-mira",
    status: "ACTIVE",
    sku: "MIRA-LAMP-24",
    basePrice: 12800,
    salePrice: null,
    costPrice: 6800,
    taxRate: 0.1,
    featured: false,
    onlineStoreEnabled: true,
    posEnabled: true,
    trackInventory: true,
    lowStockThreshold: 3,
  },
  {
    id: "prod-wedding-book",
    name: "Wedding Nail Book 2027",
    slug: "wedding-nail-book-2027",
    shortDescription: "Curated design book with booking-ready nail looks.",
    productType: "Nail Book",
    categoryId: "cat-designs",
    brandId: "brand-luna",
    status: "DRAFT",
    sku: "LUNA-BOOK-WED27",
    basePrice: 3200,
    salePrice: null,
    costPrice: 900,
    taxRate: 0.1,
    featured: false,
    onlineStoreEnabled: false,
    posEnabled: true,
    trackInventory: true,
    lowStockThreshold: 5,
  },
];

export const productVariants = [
  { id: "var-mg-rose", productId: "prod-magnet-01", name: "Rose Quartz", sku: "KOKO-MG-ROSE", price: 4800, salePrice: 4200, stockQuantity: 12, attributes: { color: "Rose", finish: "Magnet" }, status: "ACTIVE" },
  { id: "var-mg-mocha", productId: "prod-magnet-01", name: "Mocha Pearl", sku: "KOKO-MG-MOCHA", price: 4800, salePrice: 4200, stockQuantity: 4, attributes: { color: "Mocha", finish: "Magnet" }, status: "ACTIVE" },
  { id: "var-oil-10", productId: "prod-cuticle-oil", name: "10ml", sku: "LUNA-OIL-HINOKI-10", price: 1800, salePrice: null, stockQuantity: 18, attributes: { volume: "10ml" }, status: "ACTIVE" },
  { id: "var-lamp-white", productId: "prod-led-lamp", name: "Pearl White", sku: "MIRA-LAMP-24-WH", price: 12800, salePrice: null, stockQuantity: 2, attributes: { color: "Pearl White" }, status: "ACTIVE" },
  { id: "var-book-print", productId: "prod-wedding-book", name: "Printed Book", sku: "LUNA-BOOK-WED27-P", price: 3200, salePrice: null, stockQuantity: 0, attributes: { format: "Print" }, status: "DRAFT" },
];

export const inventoryLocations = [
  { id: "loc-shinjuku", name: "Shinjuku Store" },
  { id: "loc-warehouse", name: "Warehouse" },
];

export const inventoryItems = [
  { id: "inv-1", productVariantId: "var-mg-rose", locationId: "loc-shinjuku", quantityAvailable: 8, quantityReserved: 2, quantityIncoming: 20, quantityDamaged: 0 },
  { id: "inv-2", productVariantId: "var-mg-mocha", locationId: "loc-shinjuku", quantityAvailable: 3, quantityReserved: 1, quantityIncoming: 12, quantityDamaged: 0 },
  { id: "inv-3", productVariantId: "var-oil-10", locationId: "loc-shinjuku", quantityAvailable: 18, quantityReserved: 0, quantityIncoming: 0, quantityDamaged: 1 },
  { id: "inv-4", productVariantId: "var-lamp-white", locationId: "loc-shinjuku", quantityAvailable: 2, quantityReserved: 0, quantityIncoming: 5, quantityDamaged: 0 },
  { id: "inv-5", productVariantId: "var-book-print", locationId: "loc-warehouse", quantityAvailable: 0, quantityReserved: 0, quantityIncoming: 30, quantityDamaged: 0 },
];

export const orders = [
  { id: "order-1", orderNumber: "NS-20261006-0001", customer: "Aoi Tanaka", items: 3, paymentStatus: "PAID", fulfillmentStatus: "UNFULFILLED", source: "Online", total: 10800, createdAt: "2026-10-06 10:42" },
  { id: "order-2", orderNumber: "NS-20261006-0002", customer: "Mina Sato", items: 1, paymentStatus: "UNPAID", fulfillmentStatus: "PICKUP", source: "Store pickup", total: 4200, createdAt: "2026-10-06 11:18" },
];

export function getProductSummary() {
  const variantsByProduct = productVariants.reduce((acc, variant) => {
    acc[variant.productId] = (acc[variant.productId] || 0) + 1;
    return acc;
  }, {});

  return products.map((product) => {
    const brand = brands.find((item) => item.id === product.brandId);
    const category = productCategories.find((item) => item.id === product.categoryId);
    const variants = productVariants.filter((variant) => variant.productId === product.id);
    const stock = variants.reduce((total, variant) => total + variant.stockQuantity, 0);

    return {
      ...product,
      brandName: brand?.name || "Unbranded",
      categoryName: category?.name || "Uncategorized",
      variantCount: variantsByProduct[product.id] || 0,
      stock,
      isLowStock: product.trackInventory && stock <= product.lowStockThreshold,
    };
  });
}

export function getInventoryRows() {
  return inventoryItems.map((item) => {
    const variant = productVariants.find((entry) => entry.id === item.productVariantId);
    const product = products.find((entry) => entry.id === variant?.productId);
    const location = inventoryLocations.find((entry) => entry.id === item.locationId);

    return {
      ...item,
      sku: variant?.sku || "",
      variantName: variant?.name || "",
      productName: product?.name || "",
      threshold: product?.lowStockThreshold || 0,
      locationName: location?.name || "",
      availableToSell: item.quantityAvailable - item.quantityReserved,
      valueAtCost: (product?.costPrice || 0) * item.quantityAvailable,
    };
  });
}
