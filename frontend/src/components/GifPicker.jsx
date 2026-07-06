import React from 'react';

const GIFS = [
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDk1aTZoZjFjNmZtbHByNjF6eDF4YzFycXFnNW1yZDZ0bHlxbnEzNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Ju7l5y9osyymQ/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMThjNHBsdzZnYzF6NXpnNmZtbHByNjF6eDF4YzFycXFnNW1yZDZ0bHlxbnEzNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JIX9t2j0ZTN9S/giphy.gif'
];

export function GifPicker({ onGifClick }) {
  return (
    <div className="picker-container" style={{ position: 'absolute', bottom: '60px', left: '10px', zIndex: 100, background: '#1c1c1c', padding: '10px', borderRadius: '8px', border: '1px solid #333', display: 'flex', flexWrap: 'wrap', gap: '8px', width: '300px' }}>
      {GIFS.map(url => (
        <button key={url} style={{ background: 'transparent', border: 'none', cursor: 'pointer', width: '130px' }} onClick={() => onGifClick(url)}>
          <img src={url} alt="GIF" style={{ width: '100%', borderRadius: '4px' }} />
        </button>
      ))}
    </div>
  );
}
