// ============================================================
// DOGOLF PackageCard — Verdant Journey Design
// ============================================================

import { Link } from 'wouter';
import { Star, Users, Clock, Disc } from 'lucide-react';
import type { Package } from '@/lib/data';

interface PackageCardProps {
  pkg: Package;
  className?: string;
}

const badgeStyles: Record<string, string> = {
  green: 'bg-dogolf-green text-white',
  red: 'bg-dogolf-red text-white',
  purple: 'bg-dogolf-purple text-white',
};

export default function PackageCard({ pkg, className = '' }: PackageCardProps) {
  return (
    <Link href={`/inquiry?package=${pkg.id}`}>
      <div className={`group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer ${className}`}>
        {/* Image */}
        <div className="relative h-52 overflow-hidden">
          <img
            src={pkg.image}
            alt={pkg.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Badge */}
          {pkg.badge && (
            <div className={`absolute top-3 left-3 destination-badge ${badgeStyles[pkg.badgeColor || 'green']}`}>
              {pkg.badge}
            </div>
          )}

          {/* Country flag */}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
            <span className="text-sm">{pkg.flag}</span>
            <span className="text-xs font-semibold text-gray-700 font-body">{pkg.destination}</span>
          </div>

          {/* Bottom image info */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex items-center gap-2 text-white text-xs">
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {pkg.nights}박{pkg.days}일
              </span>
              <span className="flex items-center gap-1">
                <Disc size={11} />
                {pkg.holes}홀
              </span>
              {pkg.minPeople && (
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {pkg.minPeople}인~
                </span>
              )}
            </div>
            {pkg.hotelStars && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: pkg.hotelStars }).map((_, i) => (
                  <Star key={i} size={10} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {pkg.hotel && (
            <p className="text-xs text-dogolf-purple font-semibold font-body mb-1">{pkg.hotel}</p>
          )}
          <h3 className="font-display-ko font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">
            {pkg.title}
          </h3>
          <p className="text-xs text-gray-500 font-body mb-3">{pkg.subtitle}</p>

          {/* Features */}
          <div className="flex flex-wrap gap-1 mb-3">
            {pkg.features.slice(0, 3).map((feature) => (
              <span
                key={feature}
                className="text-xs bg-green-50 text-dogolf-green px-2 py-0.5 rounded-full font-body"
              >
                {feature}
              </span>
            ))}
          </div>

          {/* Price & CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              {pkg.originalPrice && (
                <p className="text-xs text-gray-400 line-through font-number">
                  {pkg.originalPrice.toLocaleString()}원~
                </p>
              )}
              <p className="price-tag text-base">
                {pkg.price === 0 ? (
                  <span className="text-dogolf-green text-sm font-semibold">가격 문의</span>
                ) : (
                  <>{pkg.price.toLocaleString()}원~</>
                )}
              </p>
            </div>
            <button className="px-3 py-1.5 bg-dogolf-green text-white text-xs font-semibold font-body rounded-lg hover:bg-dogolf-green-dark transition-colors">
              문의하기
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
