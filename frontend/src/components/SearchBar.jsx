import React from 'react';
import { FaSearch } from 'react-icons/fa';
import '../styles/SearchBar.css';

const SearchBar = ({ value, onChange, onSubmit, placeholder }) => {
    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSubmit) onSubmit();
    };

    return (
        <div className="search-container">
            <form onSubmit={handleSubmit} className="search-form">
                <div className="search-input-wrapper">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder || "Search..."}
                        className="search-input"
                    />
                </div>
                <button type="submit" className="search-button">Search</button>
            </form>
        </div>
    );
};

export default SearchBar; 