// Data access layer. Everything here talks to the local Supabase API and is
// protected by Row Level Security in supabase/migrations.
(() => {
  'use strict';
  const C = window.CJude;
  const sb = () => C.client();
  const BUCKET = 'product-images';
  const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  const toMs = (value) => (value ? new Date(value).getTime() : Date.now());

  async function unwrap(request, options) {
    const { data, error } = await request;
    if (error) throw C.friendlyError(error, options);
    return data;
  }

  function randomName() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  // ---------- mappers (database rows -> the shapes app.js already uses) ----------
  const mapProduct = (row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    size: row.size,
    condition: row.condition,
    stock: Number(row.stock),
    price: row.price === null ? null : Number(row.price),
    status: row.status,
    description: row.description,
    image: row.image_url || '',
    imagePath: row.image_path || '',
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at)
  });

  const mapReview = (row) => ({
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    userName: (row.profiles && row.profiles.name) || 'Customer',
    stars: Number(row.stars),
    feedback: row.feedback || '',
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at)
  });

  const mapSettings = (row) => ({
    storeName: row.store_name,
    tagline: row.tagline,
    announcement: row.announcement.replace(/\u00e2\u20ac\u00a2/g, '\u2022'),
    gcashName: row.gcash_name,
    gcashNumber: row.gcash_number,
    shippingFee: Number(row.shipping_fee),
    contactNumber: row.contact_number || ''
  });

  const mapOrder = (row) => ({
    id: row.order_number,
    dbId: row.id,
    customerId: row.customer_id,
    customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone },
    shipping: {
      country: row.shipping_country,
      region: row.shipping_region,
      street: row.shipping_street,
      barangay: row.shipping_barangay,
      city: row.shipping_city,
      province: row.shipping_province,
      postalCode: row.shipping_postal_code,
      notes: row.shipping_notes
    },
    payment: { method: row.payment_method, gcashReference: row.gcash_reference },
    items: (row.order_items || []).map((item) => ({
      productId: item.product_id,
      name: item.name,
      category: item.category,
      size: item.size,
      price: Number(item.price),
      qty: item.qty
    })),
    subtotal: Number(row.subtotal),
    shippingFee: Number(row.shipping_fee),
    total: Number(row.total),
    status: row.status,
    createdAt: toMs(row.created_at)
  });

  const productRow = (fields) => ({
    name: fields.name,
    category: fields.category,
    size: fields.size,
    condition: fields.condition,
    stock: fields.stock,
    price: fields.price,
    status: fields.status,
    description: fields.description
  });

  const DUPLICATE_PRODUCT = { duplicate: 'A product with the same name, category, size and condition already exists. Edit it and raise its stock instead.' };

  // ---------- product image storage ----------
  async function uploadImage(file) {
    const extension = IMAGE_EXTENSIONS[file.type];
    if (!extension) throw new Error('Please use a JPG, PNG, or WEBP image.');
    const path = `${randomName()}.${extension}`;
    const { error } = await sb().storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
    if (error) throw C.friendlyError(error);
    const { data } = sb().storage.from(BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async function removeStoredImage(path) {
    if (!path) return;
    try { await sb().storage.from(BUCKET).remove([path]); }
    catch (error) { console.warn('Could not remove stored image.', error); }
  }

  // ---------- public API ----------
  window.CJude.db = {
    products: {
      async list() {
        const rows = await unwrap(sb().from('products').select('*').order('created_at', { ascending: false }));
        return rows.map(mapProduct);
      },

      async create(fields, imageFile) {
        const uploaded = imageFile ? await uploadImage(imageFile) : null;
        try {
          const row = await unwrap(
            sb().from('products')
              .insert({ ...productRow(fields), image_url: uploaded ? uploaded.url : null, image_path: uploaded ? uploaded.path : null })
              .select().single(),
            DUPLICATE_PRODUCT
          );
          return mapProduct(row);
        } catch (error) {
          if (uploaded) await removeStoredImage(uploaded.path);
          throw error;
        }
      },

      async update(existing, fields, { file = null, removeImage = false } = {}) {
        const uploaded = file ? await uploadImage(file) : null;
        let imagePatch = {};
        if (uploaded) imagePatch = { image_url: uploaded.url, image_path: uploaded.path };
        else if (removeImage) imagePatch = { image_url: null, image_path: null };
        try {
          const row = await unwrap(
            sb().from('products').update({ ...productRow(fields), ...imagePatch }).eq('id', existing.id).select().maybeSingle(),
            DUPLICATE_PRODUCT
          );
          if (!row) throw new Error('You do not have permission to edit this product.');
          if ((uploaded || removeImage) && existing.imagePath) await removeStoredImage(existing.imagePath);
          return mapProduct(row);
        } catch (error) {
          if (uploaded) await removeStoredImage(uploaded.path);
          throw error;
        }
      },

      async remove(product) {
        const rows = await unwrap(sb().from('products').delete().eq('id', product.id).select('id'));
        if (!rows || !rows.length) throw new Error('You do not have permission to delete this product.');
        await removeStoredImage(product.imagePath);
      }
    },

    reviews: {
      async list() {
        const rows = await unwrap(sb().from('reviews').select('*, profiles(name)').order('updated_at', { ascending: false }));
        return rows.map(mapReview);
      },

      async create({ productId, userId, stars, feedback }) {
        const row = await unwrap(
          sb().from('reviews').insert({ product_id: productId, user_id: userId, stars, feedback }).select('*, profiles(name)').single(),
          { duplicate: 'You already reviewed this product. Reload and update your review instead.' }
        );
        return mapReview(row);
      },

      async update(id, { stars, feedback }) {
        const row = await unwrap(sb().from('reviews').update({ stars, feedback }).eq('id', id).select('*, profiles(name)').maybeSingle());
        if (!row) throw new Error('That review could not be updated.');
        return mapReview(row);
      },

      async remove(id) {
        const rows = await unwrap(sb().from('reviews').delete().eq('id', id).select('id'));
        if (!rows || !rows.length) throw new Error('That review could not be deleted.');
      }
    },

    settings: {
      async get() {
        const row = await unwrap(sb().from('store_settings').select('*').eq('id', 1).single());
        return mapSettings(row);
      },

      async save(settings) {
        const row = await unwrap(
          sb().from('store_settings').update({
            store_name: settings.storeName,
            tagline: settings.tagline,
            announcement: settings.announcement,
            gcash_name: settings.gcashName,
            gcash_number: settings.gcashNumber,
            shipping_fee: settings.shippingFee,
            contact_number: settings.contactNumber
          }).eq('id', 1).select().maybeSingle()
        );
        if (!row) throw new Error('Only the store owner can change store settings.');
        return mapSettings(row);
      }
    },

    orders: {
      async list() {
        const rows = await unwrap(sb().from('orders').select('*, order_items(*)').order('created_at', { ascending: false }));
        return rows.map(mapOrder);
      },

      // Prices, shipping fee and stock are decided by the database function, not the browser.
      async place({ items, customer, shipping, payment }) {
        const { data, error } = await sb().rpc('place_order', {
          p_items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
          p_customer: customer,
          p_shipping: shipping,
          p_payment: payment
        });
        if (error) throw C.friendlyError(error);
        const row = await unwrap(sb().from('orders').select('*, order_items(*)').eq('id', data).single());
        return mapOrder(row);
      },

      async setStatus(orderNumber, status) {
        const row = await unwrap(
          sb().from('orders').update({ status }).eq('order_number', orderNumber).select('*, order_items(*)').maybeSingle()
        );
        if (!row) throw new Error('Owner access required.');
        return mapOrder(row);
      }
    }
  };
})();
