import { dbGet, dbAll, dbRun } from '../database/connection.js';

export interface OtherAsset {
  id: number;
  userId: number;
  assetType: string;
  asset: string;
  currency: string;
  originalValue: number;
  marketValue: number;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOtherAssetData {
  assetType: string;
  asset: string;
  currency: string;
  originalValue: number;
  marketValue: number;
  remarks: string;
}

export interface UpdateOtherAssetData {
  assetType?: string;
  asset?: string;
  currency?: string;
  originalValue?: number;
  marketValue?: number;
  remarks?: string;
}

export class OtherAssetModel {
  static async findByUserId(userId: number): Promise<OtherAsset[]> {
    const assets = await dbAll(
      `SELECT 
        id, user_id as userId, asset_type as assetType, asset, currency,
        original_value as originalValue, market_value as marketValue, remarks,
        created_at as createdAt, updated_at as updatedAt
      FROM other_assets 
      WHERE user_id = ? 
      ORDER BY created_at DESC`,
      [userId]
    );
    
    return assets as OtherAsset[];
  }
  
  static async findById(id: number, userId: number): Promise<OtherAsset | null> {
    const asset = await dbGet(
      `SELECT 
        id, user_id as userId, asset_type as assetType, asset, currency,
        original_value as originalValue, market_value as marketValue, remarks,
        created_at as createdAt, updated_at as updatedAt
      FROM other_assets 
      WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    
    return asset as OtherAsset | null;
  }
  
  static async create(userId: number, assetData: CreateOtherAssetData): Promise<OtherAsset> {
    const result = await dbRun(
      `INSERT INTO other_assets (
        user_id, asset_type, asset, currency, original_value, market_value, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        assetData.assetType, 
        assetData.asset, 
        assetData.currency, 
        assetData.originalValue, 
        assetData.marketValue, 
        assetData.remarks
      ]
    );
    
    const asset = await this.findById(result.lastID, userId);
    if (!asset) {
      throw new Error('Failed to create asset');
    }
    
    return asset;
  }
  
  static async update(id: number, userId: number, assetData: UpdateOtherAssetData): Promise<OtherAsset | null> {
    const updateFields = [];
    const values = [];
    
    if (assetData.assetType !== undefined) {
      updateFields.push('asset_type = ?');
      values.push(assetData.assetType);
    }
    
    if (assetData.asset !== undefined) {
      updateFields.push('asset = ?');
      values.push(assetData.asset);
    }
    
    if (assetData.currency !== undefined) {
      updateFields.push('currency = ?');
      values.push(assetData.currency);
    }
    
    if (assetData.originalValue !== undefined) {
      updateFields.push('original_value = ?');
      values.push(assetData.originalValue);
    }
    
    if (assetData.marketValue !== undefined) {
      updateFields.push('market_value = ?');
      values.push(assetData.marketValue);
    }
    
    if (assetData.remarks !== undefined) {
      updateFields.push('remarks = ?');
      values.push(assetData.remarks);
    }
    
    if (updateFields.length === 0) {
      return await this.findById(id, userId);
    }
    
    updateFields.push("updated_at = datetime('now', 'localtime')");
    values.push(id, userId);
    
    await dbRun(
      `UPDATE other_assets SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    
    return await this.findById(id, userId);
  }
  
  static async delete(id: number, userId: number): Promise<boolean> {
    const result = await dbRun(
      'DELETE FROM other_assets WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    return result.changes > 0;
  }
}