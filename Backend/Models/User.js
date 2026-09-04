import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, default: 'admin' },
  passwordHash: { type: String, required: true },
  lastLogin: { type: Date, default: null },
  role: { type: String, default: 'administrator' }
}, { timestamps: true });

userSchema.methods.verifyPassword = async function (password) {
  return await bcrypt.compare(password, this.passwordHash);
};

export default mongoose.model('User', userSchema);
