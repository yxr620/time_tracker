import React, { useState, useEffect } from 'react';
import {
  IonIcon,
} from '@ionic/react';
import { addOutline, trashOutline, createOutline, checkmarkOutline, closeOutline } from 'ionicons/icons';
import { useCategoryStore } from '../../stores/categoryStore';
import { COLOR_PALETTE, PRESET_CATEGORY_IDS } from '../../config/categoryColors';
import type { Category } from '../../services/db';
import './CategoryManagerTab.css';

export const CategoryManagerTab: React.FC = () => {
  const { categories, loadCategories, addCategory, updateCategory, deleteCategory } = useCategoryStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PALETTE[6]); // 默认选第一个非预设颜色

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateCategory(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addCategory({ name: newName.trim(), color: newColor });
    setNewName('');
    setNewColor(COLOR_PALETTE[6]);
    setShowAdd(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('删除后，已有记录将显示为"未分类"。确定删除？')) {
      await deleteCategory(id);
    }
  };

  return (
    <div className="category-manager">
      <div className="category-manager-list">
        {categories.map(cat => {
          const isPreset = cat.isPreset || PRESET_CATEGORY_IDS.has(cat.id);
          const isEditing = editingId === cat.id;

          return (
            <div key={cat.id} className="category-manager-item">
              {isEditing ? (
                <>
                  <div className="category-edit-row">
                    <span
                      className="category-color-dot"
                      style={{ backgroundColor: editColor }}
                    />
                    <input
                      className="category-edit-input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <button className="category-action-btn save" onClick={handleSaveEdit}>
                      <IonIcon icon={checkmarkOutline} />
                    </button>
                    <button className="category-action-btn cancel" onClick={handleCancelEdit}>
                      <IonIcon icon={closeOutline} />
                    </button>
                  </div>
                  <div className="color-palette">
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c}
                        className={`color-swatch ${editColor === c ? 'selected' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setEditColor(c)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="category-display-row">
                  <span
                    className="category-color-dot"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="category-name">{cat.name}</span>
                  {isPreset && <span className="category-preset-badge">预设</span>}
                  <div className="category-actions">
                    <button className="category-action-btn edit" onClick={() => handleStartEdit(cat)}>
                      <IonIcon icon={createOutline} />
                    </button>
                    {!isPreset && (
                      <button className="category-action-btn delete" onClick={() => handleDelete(cat.id)}>
                        <IonIcon icon={trashOutline} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAdd ? (
        <div className="category-add-form">
          <div className="category-edit-row">
            <span
              className="category-color-dot"
              style={{ backgroundColor: newColor }}
            />
            <input
              className="category-edit-input"
              placeholder="输入类别名称"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setShowAdd(false);
              }}
            />
            <button className="category-action-btn save" onClick={handleAdd} disabled={!newName.trim()}>
              <IonIcon icon={checkmarkOutline} />
            </button>
            <button className="category-action-btn cancel" onClick={() => setShowAdd(false)}>
              <IonIcon icon={closeOutline} />
            </button>
          </div>
          <div className="color-palette">
            {COLOR_PALETTE.map(c => (
              <button
                key={c}
                className={`color-swatch ${newColor === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
        </div>
      ) : (
        <button className="category-add-btn" onClick={() => setShowAdd(true)}>
          <IonIcon icon={addOutline} />
          新增类别
        </button>
      )}
    </div>
  );
};
