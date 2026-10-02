'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Role, MovementType } from '@prisma/client';
import {
  Package,
  Plus,
  Search,
  Filter,
  Layers,
  History,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Boxes,
  Edit2,
  Archive,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Tag,
  DollarSign,
  Lock,
} from 'lucide-react';
import {
  createProductAction,
  updateProductAction,
  archiveProductAction,
  adjustInventoryAction,
  createCategoryAction,
} from '@/lib/actions/products';
import {
  canCreateProduct,
  canEditProduct,
  canArchiveProduct,
  canManageCategories,
  canAdjustInventory,
} from '@/lib/auth/product-auth';

export interface SerializedCategory {
  id: string;
  name: string;
  description: string | null;
  productCount?: number;
}

export interface SerializedProduct {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: string;
  cost: string;
  isActive: boolean;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  inventory: {
    quantity: number;
    reorderLevel: number;
  } | null;
  createdAt: string;
}

interface ProductsManagementClientProps {
  orgSlug: string;
  tenantName: string;
  currentUserRole: Role;
  products: SerializedProduct[];
  categories: SerializedCategory[];
}

export function ProductsManagementClient({
  orgSlug,
  tenantName,
  currentUserRole,
  products,
  categories,
}: ProductsManagementClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Feedback State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SerializedProduct | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<SerializedProduct | null>(null);
  const [archivingProduct, setArchivingProduct] = useState<SerializedProduct | null>(null);

  // Form State for Add Product
  const [addName, setAddName] = useState('');
  const [addSku, setAddSku] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addPrice, setAddPrice] = useState('0.00');
  const [addCost, setAddCost] = useState('0.00');
  const [addCategoryId, setAddCategoryId] = useState('');
  const [addInitialStock, setAddInitialStock] = useState('0');
  const [addReorderLevel, setAddReorderLevel] = useState('5');

  // Form State for Edit Product
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('0.00');
  const [editCost, setEditCost] = useState('0.00');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editReorderLevel, setEditReorderLevel] = useState('5');
  const [editIsActive, setEditIsActive] = useState(true);

  // Form State for Inventory Adjustment
  const [adjType, setAdjType] = useState<MovementType>(MovementType.STOCK_IN);
  const [adjQuantity, setAdjQuantity] = useState('1');
  const [adjReason, setAdjReason] = useState('');

  // Form State for Category Manager
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Role permissions
  const canCreate = canCreateProduct(currentUserRole).allowed;
  const canEdit = canEditProduct(currentUserRole).allowed;
  const canArchive = canArchiveProduct(currentUserRole).allowed;
  const canAdjust = canAdjustInventory(currentUserRole).allowed;
  const canCategory = canManageCategories(currentUserRole).allowed;

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      (p.description?.toLowerCase().includes(query) ?? false);

    const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;

    const matchesStatus =
      statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? p.isActive : !p.isActive);

    const currentQty = p.inventory?.quantity ?? 0;
    const reorderLvl = p.inventory?.reorderLevel ?? 0;

    let matchesStock = true;
    if (stockFilter === 'OUT_OF_STOCK') {
      matchesStock = currentQty === 0;
    } else if (stockFilter === 'LOW_STOCK') {
      matchesStock = currentQty > 0 && currentQty <= reorderLvl;
    } else if (stockFilter === 'IN_STOCK') {
      matchesStock = currentQty > reorderLvl;
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesStock;
  });

  // Summary Metrics
  const metrics = {
    total: products.length,
    active: products.filter((p) => p.isActive).length,
    lowStock: products.filter((p) => {
      const q = p.inventory?.quantity ?? 0;
      const r = p.inventory?.reorderLevel ?? 0;
      return p.isActive && q <= r;
    }).length,
    outOfStock: products.filter((p) => (p.inventory?.quantity ?? 0) === 0 && p.isActive).length,
    categoriesCount: categories.length,
  };

  // Handlers
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createProductAction(orgSlug, {
        name: addName.trim(),
        sku: addSku.trim().toUpperCase(),
        description: addDescription.trim(),
        price: parseFloat(addPrice) || 0,
        cost: parseFloat(addCost) || 0,
        categoryId: addCategoryId || null,
        initialStock: parseInt(addInitialStock, 10) || 0,
        reorderLevel: parseInt(addReorderLevel, 10) || 0,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Product created successfully.' });
        setIsAddModalOpen(false);
        setAddName('');
        setAddSku('');
        setAddDescription('');
        setAddPrice('0.00');
        setAddCost('0.00');
        setAddCategoryId('');
        setAddInitialStock('0');
        setAddReorderLevel('5');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to create product.' });
      }
    });
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await updateProductAction(orgSlug, {
        productId: editingProduct.id,
        name: editName.trim(),
        sku: editSku.trim().toUpperCase(),
        description: editDescription.trim(),
        price: parseFloat(editPrice) || 0,
        cost: parseFloat(editCost) || 0,
        categoryId: editCategoryId || null,
        reorderLevel: parseInt(editReorderLevel, 10) || 0,
        isActive: editIsActive,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Product updated successfully.' });
        setEditingProduct(null);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update product.' });
      }
    });
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await adjustInventoryAction(orgSlug, {
        productId: adjustingProduct.id,
        type: adjType,
        quantity: parseInt(adjQuantity, 10) || 0,
        reason: adjReason.trim(),
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Stock adjusted successfully.' });
        setAdjustingProduct(null);
        setAdjQuantity('1');
        setAdjReason('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to adjust stock.' });
      }
    });
  };

  const handleArchiveProduct = async () => {
    if (!archivingProduct) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await archiveProductAction(orgSlug, {
        productId: archivingProduct.id,
        isActive: !archivingProduct.isActive,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Product status updated.' });
        setArchivingProduct(null);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to change product status.' });
      }
    });
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createCategoryAction(orgSlug, {
        name: newCatName.trim(),
        description: newCatDesc.trim(),
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Category created.' });
        setNewCatName('');
        setNewCatDesc('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to create category.' });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center space-x-2.5 text-xs font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Products & Inventory</h1>
            <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
              {metrics.total} {metrics.total === 1 ? 'Product' : 'Products'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage catalog pricing, categories, and track multi-tenant inventory for <strong className="text-foreground">{tenantName}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Inventory History Link */}
          <Link
            href={`/${orgSlug}/products/inventory`}
            className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            <History className="h-4 w-4 text-primary" />
            <span>Movement History</span>
          </Link>

          {/* Manage Categories Button */}
          {canCategory ? (
            <button
              onClick={() => {
                setFeedback(null);
                setIsCategoryModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
            >
              <Layers className="h-4 w-4 text-indigo-400" />
              <span>Categories ({categories.length})</span>
            </button>
          ) : null}

          {/* Add Product Button */}
          {canCreate ? (
            <button
              id="add-product-btn"
              onClick={() => {
                setFeedback(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </button>
          ) : (
            <div
              title="Only Owners and Administrators can add products"
              className="inline-flex items-center space-x-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed opacity-75"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Add Product (Admin Only)</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Products
          </div>
          <div className="text-xl font-bold text-foreground">{metrics.total}</div>
          <div className="text-[10px] text-muted-foreground">{metrics.active} active in catalog</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Low Stock Alerts
          </div>
          <div className={`text-xl font-bold ${metrics.lowStock > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {metrics.lowStock}
          </div>
          <div className="text-[10px] text-muted-foreground">Items at or below reorder level</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Out of Stock
          </div>
          <div className={`text-xl font-bold ${metrics.outOfStock > 0 ? 'text-destructive' : 'text-emerald-400'}`}>
            {metrics.outOfStock}
          </div>
          <div className="text-[10px] text-muted-foreground">Zero units available</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Categories
          </div>
          <div className="text-xl font-bold text-indigo-400">{metrics.categoriesCount}</div>
          <div className="text-[10px] text-muted-foreground">Active organizational groups</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Category Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-muted-foreground">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-muted-foreground">Stock:</span>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>

          {/* Active/Archived Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-muted-foreground">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ACTIVE">Active Only</option>
              <option value="ARCHIVED">Archived Only</option>
              <option value="ALL">All Statuses</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Product / SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price / Cost</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Package className="h-8 w-8 text-muted-foreground/50" />
                      <p className="font-medium text-xs">No products found.</p>
                      <p className="text-[11px] text-muted-foreground/75">
                        Try adjusting your search query, filters, or add a new product.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const qty = product.inventory?.quantity ?? 0;
                  const reorder = product.inventory?.reorderLevel ?? 0;

                  const isOutOfStock = qty === 0;
                  const isLowStock = qty > 0 && qty <= reorder;

                  return (
                    <tr key={product.id} className="hover:bg-muted/20 transition-colors">
                      {/* Name & SKU */}
                      <td className="px-4 py-3.5">
                        <div>
                          <div className="font-medium text-foreground flex items-center space-x-2">
                            <span>{product.name}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center space-x-1.5 mt-0.5">
                            <span className="font-mono text-primary font-medium">{product.sku}</span>
                            {product.description && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-xs">{product.description}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {product.category ? (
                          <span className="inline-flex items-center space-x-1 rounded bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[11px] font-medium text-indigo-400">
                            <Tag className="h-3 w-3" />
                            <span>{product.category.name}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/60 italic">Uncategorized</span>
                        )}
                      </td>

                      {/* Price & Cost */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-foreground">${parseFloat(product.price).toFixed(2)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Cost: ${parseFloat(product.cost).toFixed(2)}
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-sm text-foreground">{qty}</span>
                          {isOutOfStock ? (
                            <span className="inline-flex items-center rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                              Low Stock (≤{reorder})
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                              In Stock
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {product.isActive ? (
                          <span className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                            Archived
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Adjust Stock Button */}
                          <button
                            onClick={() => {
                              setAdjustingProduct(product);
                              setAdjType(MovementType.STOCK_IN);
                              setAdjQuantity('1');
                              setAdjReason('');
                              setFeedback(null);
                            }}
                            disabled={!canAdjust || isPending}
                            title={!canAdjust ? 'Admin or Owner only' : 'Adjust Inventory Stock'}
                            className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                              canAdjust
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'text-muted-foreground/30 cursor-not-allowed'
                            }`}
                          >
                            <Boxes className="h-3.5 w-3.5" />
                            <span>Stock</span>
                          </button>

                          {/* Edit Product Button */}
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setEditName(product.name);
                              setEditSku(product.sku);
                              setEditDescription(product.description || '');
                              setEditPrice(product.price);
                              setEditCost(product.cost);
                              setEditCategoryId(product.categoryId || '');
                              setEditReorderLevel(String(product.inventory?.reorderLevel ?? 5));
                              setEditIsActive(product.isActive);
                              setFeedback(null);
                            }}
                            disabled={!canEdit || isPending}
                            title={!canEdit ? 'Admin or Owner only' : 'Edit Product'}
                            className={`p-1.5 rounded-md transition-colors ${
                              canEdit
                                ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                : 'text-muted-foreground/30 cursor-not-allowed'
                            }`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Archive/Activate Toggle Button */}
                          <button
                            onClick={() => {
                              setArchivingProduct(product);
                              setFeedback(null);
                            }}
                            disabled={!canArchive || isPending}
                            title={!canArchive ? 'Admin or Owner only' : product.isActive ? 'Archive Product' : 'Reactivate Product'}
                            className={`p-1.5 rounded-md transition-colors ${
                              canArchive
                                ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                : 'text-muted-foreground/30 cursor-not-allowed'
                            }`}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD PRODUCT */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Add New Product</h2>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ergonomic Office Chair"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="CHR-ERG-01"
                    value={addSku}
                    onChange={(e) => setAddSku(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Category
                  </label>
                  <select
                    value={addCategoryId}
                    onChange={(e) => setAddCategoryId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  >
                    <option value="">(None / Uncategorized)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Selling Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="299.99"
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Unit Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="150.00"
                    value={addCost}
                    onChange={(e) => setAddCost(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Initial Stock (Units)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="10"
                    value={addInitialStock}
                    onChange={(e) => setAddInitialStock(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reorder Alert Level
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="5"
                    value={addReorderLevel}
                    onChange={(e) => setAddReorderLevel(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="High-grade ergonomic mesh chair with lumbar support"
                    value={addDescription}
                    onChange={(e) => setAddDescription(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center space-x-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Product</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDIT PRODUCT */}
      {/* ========================================================= */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Edit2 className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Edit Product</h2>
              </div>
              <button onClick={() => setEditingProduct(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Category
                  </label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  >
                    <option value="">(None / Uncategorized)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Selling Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Unit Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reorder Alert Level
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={editReorderLevel}
                    onChange={(e) => setEditReorderLevel(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Catalog Status
                  </label>
                  <select
                    value={editIsActive ? 'ACTIVE' : 'ARCHIVED'}
                    onChange={(e) => setEditIsActive(e.target.value === 'ACTIVE')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  >
                    <option value="ACTIVE">Active (Available)</option>
                    <option value="ARCHIVED">Archived (Deactivated)</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center space-x-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: INVENTORY ADJUSTMENT */}
      {/* ========================================================= */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Boxes className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Adjust Inventory Stock</h2>
              </div>
              <button onClick={() => setAdjustingProduct(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Target Product Summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-xs">
              <div className="font-semibold text-foreground">{adjustingProduct.name}</div>
              <div className="text-muted-foreground font-mono text-[11px]">SKU: {adjustingProduct.sku}</div>
              <div className="text-[11px] text-muted-foreground pt-1 flex items-center justify-between">
                <span>Current Stock:</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {adjustingProduct.inventory?.quantity ?? 0} units
                </span>
              </div>
            </div>

            <form onSubmit={handleAdjustStock} className="space-y-4">
              {/* Adjustment Type Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Operation Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjType(MovementType.STOCK_IN)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      adjType === MovementType.STOCK_IN
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <ArrowUpRight className="h-4 w-4 mb-1" />
                    <span>Stock In (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjType(MovementType.STOCK_OUT)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      adjType === MovementType.STOCK_OUT
                        ? 'border-destructive bg-destructive/10 text-destructive font-semibold'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <ArrowDownRight className="h-4 w-4 mb-1" />
                    <span>Stock Out (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjType(MovementType.ADJUSTMENT)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      adjType === MovementType.ADJUSTMENT
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <RefreshCw className="h-4 w-4 mb-1" />
                    <span>Recount (=)</span>
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {adjType === MovementType.STOCK_IN && 'Units to Add'}
                  {adjType === MovementType.STOCK_OUT && 'Units to Remove'}
                  {adjType === MovementType.ADJUSTMENT && 'Desired Final Stock Count'}
                </label>
                <input
                  type="number"
                  step="1"
                  min={adjType === MovementType.ADJUSTMENT ? '0' : '1'}
                  required
                  value={adjQuantity}
                  onChange={(e) => setAdjQuantity(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  {adjType === MovementType.STOCK_IN && 'Increases inventory by the entered quantity.'}
                  {adjType === MovementType.STOCK_OUT && 'Decreases inventory. Cannot exceed current stock.'}
                  {adjType === MovementType.ADJUSTMENT && 'Sets total stock directly to this exact value (0 or greater).'}
                </p>
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Audit Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received shipment PO-402, Stock count discrepancy"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center space-x-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Adjusting...</span>
                    </>
                  ) : (
                    <span>Record Stock Adjustment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: CATEGORY MANAGER */}
      {/* ========================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="h-5 w-5 text-indigo-400" />
                <h2 className="text-base font-bold text-foreground">Category Management</h2>
              </div>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Existing Categories List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Existing Categories ({categories.length})
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-border bg-muted/20 p-2">
                {categories.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">No categories created yet.</div>
                ) : (
                  categories.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2 rounded-md bg-card border border-border text-xs"
                    >
                      <div>
                        <div className="font-medium text-foreground">{c.name}</div>
                        {c.description && <div className="text-[10px] text-muted-foreground">{c.description}</div>}
                      </div>
                      <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-mono font-semibold">
                        {c.productCount ?? 0} {c.productCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add Category Form */}
            <form onSubmit={handleCreateCategory} className="space-y-3 pt-2 border-t border-border">
              <div className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Create New Category
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hardware, Furniture, Electronics"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Physical office hardware and appliances"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isPending || !newCatName.trim()}
                  className="inline-flex items-center space-x-1.5 rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Add Category</span>
                </button>
              </div>
            </form>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-md border border-border bg-card px-4 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: ARCHIVE PRODUCT CONFIRMATION */}
      {/* ========================================================= */}
      {archivingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">
                  {archivingProduct.isActive ? 'Archive Product' : 'Reactivate Product'}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {archivingProduct.name} ({archivingProduct.sku})
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                {archivingProduct.isActive ? (
                  <>
                    Archiving this product will deactivate it in the catalog. Its historical inventory ledger and stock records will be safely preserved.
                  </>
                ) : (
                  <>
                    Reactivating this product will make it visible and active again in the catalog.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setArchivingProduct(null)}
                className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveProduct}
                disabled={isPending}
                className="inline-flex items-center space-x-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>{archivingProduct.isActive ? 'Confirm Archive' : 'Confirm Reactivate'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
