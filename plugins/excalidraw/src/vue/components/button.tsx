import React from 'react';

export const Button = (onclick) => {
    return (
      <button
        style={{
          background: '#70b1ec',
          border: 'none',
          borderRadius: '4px',
          color: '#fff',
          width: 'max-content',
          padding: '8px',
          fontWeight: 'bold'
        }}
        onClick={ onclick }
      >
        Сохранить
      </button>
    );
};

