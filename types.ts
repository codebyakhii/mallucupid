
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

export interface Lifestyle {
  drinking: string;
  smoking: string;
  workout: string;
  pets: string;
  diet: string;
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
  pronouns: string;
  lifestyle: Lifestyle;
  jobTitle: string;
  company: string;
  education: string;
  latitude: number | null;
  longitude: number | null;
  showMe: string;
  ageMin: number;
  ageMax: number;
  maxDistance: number;
  showAge: boolean;
  showDistance: boolean;
  showOrientation: boolean;
  role?: UserRole;
  status?: 'active' | 'blocked';
  bankInfo?: BankInfo;
  verificationDocs?: VerificationDocs;
  balance?: number;
  proExpiry?: number;
}

export interface ProConfig {
  price: number;
  duration: number; // in days
}

export type View = 'landing' | 'login' | 'signup' | 'forgotPassword' | 'discover' | 'friends' | 'profile' | 'chat' | 'inbox' | 'userDetails' | 'notifications' | 'privateGallery' | 'privateGalleryView' | 'earnings' | 'verification' | 'blockedUsers' | 'adminDashboard' | 'bankAccount' | 'terms' | 'privacy';

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
  user_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'held' | 'rejected';
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
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

export interface Earning {
  id: string;
  user_id: string;
  from_user_id: string | null;
  type: 'gallery_purchase' | 'tip' | 'other';
  amount: number;
  description: string;
  related_id: string | null;
  created_at: string;
}


