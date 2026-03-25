
export type Gender = 'Men' | 'Women' | 'Transman' | 'Transwoman' | 'Other';
export type RelationshipGoal = 'Longterm Partner' | 'Short term' | 'FWB' | 'Any' | 'New Friends';
export type LookingFor = 'Men' | 'Women' | 'Transmen' | 'Transwomen' | 'All';
export type Orientation = 'Straight' | 'Gay' | 'Lesbian' | 'Bisexual' | 'Queer' | 'Pansexual';
export type UserRole = 'user' | 'admin';

export interface BankInfo {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiId?: string;
}

export interface VerificationDocs {
  idFront: string;
  idBack: string;
  selfie: string;
}

export interface Profile {
  id: string;
  name: string;
  username: string;
  email?: string;
  age: number;
  dob: string;
  location: string;
  bio: string;
  interests: string[];
  imageUrl: string;
  images: string[];
  occupation: string;
  gender: Gender;
  verified: boolean;
  relationshipGoal: RelationshipGoal;
  lookingFor: LookingFor;
  orientation: Orientation;
  role?: UserRole;
  status?: 'active' | 'blocked';
  bankInfo?: BankInfo;
  verificationDocs?: VerificationDocs;
  balance?: number;
  proExpiry?: number; // Timestamp when Pro Plan expires
}

export interface ProConfig {
  price: number;
  duration: number; // in days
}

export type View = 'landing' | 'login' | 'signup' | 'forgotPassword' | 'discover' | 'friends' | 'profile' | 'chat' | 'inbox' | 'userDetails' | 'notifications' | 'secretGallery' | 'secretGalleryView' | 'earnings' | 'verification' | 'blockedUsers' | 'exclusiveRoom' | 'exclusiveRoomView' | 'adminDashboard' | 'bankAccount' | 'terms' | 'privacy';

export interface Notification {
  id: string;
  type: 'request' | 'update' | 'acceptance' | 'payout';
  profile?: Profile;
  text: string;
  timestamp: number;
  status?: 'pending' | 'accepted' | 'rejected';
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  status: 'pending' | 'approved' | 'held' | 'rejected';
  timestamp: number;
}

export interface UserReport {
  id: string;
  reporterId: string;
  targetId: string;
  reason: string;
  timestamp: number;
}

export interface ConnectionRequest {
  id: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  timestamp: number;
}

export interface PurchaseRecord {
  contentId: string;
  userId: string;
}

export interface SubscriptionRecord {
  roomId: string;
  userId: string;
  expiry: number;
}

export interface Earning {
  id: string;
  type: 'purchase' | 'subscription';
  amount: number;
  timestamp: number;
  username: string;
  targetId: string;
}

export interface SecretContent {
  id: string;
  type: 'image' | 'video';
  name: string;
  url: string;
  amount: number;
  metadata: string;
  ownerId: string;
}

export interface Subscriber {
  id: string;
  username: string;
  imageUrl: string;
  joinedAt: number;
}
