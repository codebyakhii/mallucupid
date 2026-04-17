
import React from 'react';

const DesktopBlocker: React.FC = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col select-none">
      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#FF4458] to-[#FF7854] rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">M</span>
            </div>
            <span className="text-xl font-black text-gray-900">mallucupid</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#features" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#safety" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">Safety</a>
            <a href="#download" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">Download</a>
            <button className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-[#FF4458] to-[#FF7854] rounded-full hover:shadow-lg hover:shadow-red-200/50 transition-all active:scale-95">
              Log in
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FF4458] via-[#FF6B54] to-[#FF7854]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-[10%] w-48 h-80 bg-white/20 rounded-3xl rotate-[-12deg]" />
          <div className="absolute top-10 left-[25%] w-48 h-80 bg-white/15 rounded-3xl rotate-[6deg]" />
          <div className="absolute top-16 right-[25%] w-48 h-80 bg-white/15 rounded-3xl rotate-[-6deg]" />
          <div className="absolute top-20 right-[10%] w-48 h-80 bg-white/20 rounded-3xl rotate-[12deg]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 py-32 text-center text-white">
          <h1 className="text-6xl md:text-7xl font-black leading-tight tracking-tight">
            Start something<br />epic.
          </h1>
          <p className="mt-6 text-xl font-medium opacity-90 max-w-xl mx-auto leading-relaxed">
            Kerala&apos;s own dating app. Swipe right, make connections, and find your perfect match — all from your phone.
          </p>
          <div className="mt-10 flex items-center justify-center">
            <a href="/mallucupid.apk" download className="flex items-center gap-3 bg-white text-gray-900 px-8 py-4 rounded-2xl hover:bg-gray-100 transition-colors shadow-xl shadow-black/10 font-bold text-lg">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download Android App
            </a>
          </div>
        </div>
      </section>

      {/* ─── FEATURES SECTION ─── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-black text-center text-gray-900 mb-4">Why Mallu Cupid?</h2>
          <p className="text-lg text-gray-500 text-center mb-16 max-w-2xl mx-auto">Made for Kerala. Built for meaningful connections.</p>
          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center p-8 rounded-3xl bg-gradient-to-b from-red-50 to-white border border-red-100/50">
              <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-[#FF4458] to-[#FF7854] rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Swipe & Match</h3>
              <p className="text-gray-500 leading-relaxed">Discover profiles near you. Swipe right to like, left to pass. When you both swipe right — it&apos;s a match!</p>
            </div>
            <div className="text-center p-8 rounded-3xl bg-gradient-to-b from-amber-50 to-white border border-amber-100/50">
              <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Verified Profiles</h3>
              <p className="text-gray-500 leading-relaxed">ID-verified users you can trust. Real people, real connections. No fakes, no catfish.</p>
            </div>
            <div className="text-center p-8 rounded-3xl bg-gradient-to-b from-green-50 to-white border border-green-100/50">
              <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-green-600 to-green-500 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Chat & Connect</h3>
              <p className="text-gray-500 leading-relaxed">Private messaging with your matches. Share moments, plan dates, and build real relationships.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRO SECTION ─── */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 px-4 py-1.5 rounded-full mb-6">
            <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span className="text-sm font-bold text-amber-700">PRO</span>
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-4">Upgrade your dating game</h2>
          <p className="text-lg text-gray-500 mb-12 max-w-xl mx-auto">Unlimited likes, rewind, global discovery, and a Pro badge — starting at just ₹59/week.</p>
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { icon: '❤️', label: 'Unlimited Likes' },
              { icon: '💬', label: 'Unlimited Messages' },
              { icon: '↩️', label: 'Rewind Swipes' },
              { icon: '🌍', label: 'Global Discovery' },
              { icon: '⭐', label: 'Pro Badge' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 bg-white px-5 py-3 rounded-2xl shadow-sm border border-gray-100">
                <span className="text-lg">{f.icon}</span>
                <span className="text-sm font-semibold text-gray-700">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SAFETY SECTION ─── */}
      <section id="safety" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-black text-gray-900 mb-4">Your safety matters</h2>
          <p className="text-lg text-gray-500 mb-12 max-w-xl mx-auto">We&apos;re committed to keeping Mallu Cupid a safe space for everyone.</p>
          <div className="grid md:grid-cols-2 gap-6 text-left max-w-2xl mx-auto">
            {[
              { title: 'Photo Verification', desc: 'Every user can verify their identity with a selfie and government ID.' },
              { title: 'Report & Block', desc: 'Easily report or block anyone who makes you uncomfortable.' },
              { title: 'Private Profiles', desc: 'Control who sees your photos and personal information.' },
              { title: 'Secure Payments', desc: 'All transactions are processed securely through Razorpay.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 p-5 rounded-2xl bg-gray-50">
                <div className="w-6 h-6 mt-0.5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DOWNLOAD CTA ─── */}
      <section id="download" className="py-24 bg-gradient-to-br from-[#FF4458] via-[#FF6B54] to-[#FF7854] text-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-black mb-4">Get the app!</h2>
          <p className="text-lg opacity-90 mb-10 max-w-md mx-auto">Download Mallu Cupid on your phone and start swiping today.</p>
          <div className="flex items-center justify-center">
            <a href="/mallucupid.apk" download className="flex items-center gap-3 bg-white text-gray-900 px-8 py-4 rounded-2xl hover:bg-gray-100 transition-colors shadow-xl shadow-black/10 font-bold text-lg">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download Android App
            </a>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-white border-t border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <h3 className="font-bold text-gray-900 mb-4">Legal</h3>
              <ul className="space-y-2.5">
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Privacy</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Terms</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Cookie Policy</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Intellectual Property</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-4">Company</h3>
              <ul className="space-y-2.5">
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">About</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Blog</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Careers</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-4">Social</h3>
              <div className="flex items-center gap-4">
                <a href="#" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a href="#" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                </a>
                <a href="#" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-4">Support</h3>
              <ul className="space-y-2.5">
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">FAQ</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Safety Tips</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Community Guidelines</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <a href="/mallucupid.apk" download className="flex items-center gap-2.5 bg-gradient-to-r from-[#FF4458] to-[#FF7854] text-white px-5 py-2.5 rounded-lg text-xs font-bold hover:shadow-lg transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download Android App
            </a>
            <p className="text-sm text-gray-400">© 2026 Mallu Cupid. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DesktopBlocker;
