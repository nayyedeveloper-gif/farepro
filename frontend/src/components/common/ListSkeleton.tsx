import React from 'react';

interface ListSkeletonProps {
  count?: number;
}

const ListSkeleton: React.FC<ListSkeletonProps> = ({ count = 6 }) => (
  <div className="skeleton-list">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-item">
        <div className="skeleton-avatar" />
        <div className="skeleton-lines">
          <div className="skeleton-line short" />
          <div className="skeleton-line medium" />
        </div>
      </div>
    ))}
  </div>
);

export default ListSkeleton;
