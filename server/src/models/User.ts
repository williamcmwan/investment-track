import { dbGet, dbRun } from '../database/connection.js';
import bcrypt from 'bcryptjs';

export interface User {
  id: number;
  email: string;
  name: string;
  baseCurrency: string;
  twoFactorEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  baseCurrency?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class UserModel {
  static async create(userData: CreateUserData): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const baseCurrency = userData.baseCurrency || 'HKD';
    
    const result = await dbRun(
      'INSERT INTO users (email, password_hash, name, base_currency) VALUES (?, ?, ?, ?)',
      [userData.email, hashedPassword, userData.name, baseCurrency]
    );
    
    const user = await this.findById(result.lastID);
    if (!user) {
      throw new Error('Failed to create user');
    }
    
    return user;
  }
  
  static async findById(id: number): Promise<User | null> {
    const user = await dbGet(
      'SELECT id, email, name, base_currency as baseCurrency, two_factor_enabled as twoFactorEnabled, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?',
      [id]
    );
    
    return user as User | null;
  }
  
  static async findByEmail(email: string): Promise<User | null> {
    const user = await dbGet(
      'SELECT id, email, name, base_currency as baseCurrency, created_at as createdAt, updated_at as updatedAt FROM users WHERE email = ?',
      [email]
    );
    
    return user as User | null;
  }
  
  static async validatePassword(email: string, password: string): Promise<User | null> {
    const user = await dbGet(
      'SELECT id, email, password_hash, name, base_currency as baseCurrency, created_at as createdAt, updated_at as updatedAt FROM users WHERE email = ?',
      [email]
    );
    
    if (!user) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }
    
    // Remove password_hash from returned user
    const { password_hash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
  
  static async updateBaseCurrency(id: number, baseCurrency: string): Promise<User | null> {
    await dbRun(
      'UPDATE users SET base_currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [baseCurrency, id]
    );
    
    return await this.findById(id);
  }
}
