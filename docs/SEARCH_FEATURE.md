# Project Search Feature

## Overview
The search feature provides full-text search capabilities for projects, allowing users to search across project titles, descriptions, and categories with relevance scoring and filtering options.

## Features

### 1. Full-Text Search
- **Search Fields**: Title, Description, Category
- **Search Engine**: PostgreSQL full-text search with tsvector
- **Relevance Scoring**: Weighted scoring (Title: A, Description: B, Category: C)
- **Partial Matching**: Supports partial word matching and stemming

### 2. Search Endpoints

#### GET /projects
Search and filter projects with optional parameters.

**Query Parameters:**
- `search` (string, optional): Search query (min 2 characters)
- `category` (enum, optional): Filter by single category
- `categories` (array, optional): Filter by multiple categories
- `status` (enum, optional): Filter by single status
- `statuses` (array, optional): Filter by multiple statuses
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Results per page (default: 10)
- `sortBy` (string, optional): Sort field (createdAt, updatedAt, title, goalAmount, raisedAmount, relevance)
- `sortOrder` (string, optional): Sort order (asc, desc, default: desc)

**Response Format:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Project Title",
      "description": "Project description",
      "category": "EDUCATION",
      "status": "ACTIVE",
      "relevance_score": 0.85,
      "match_type": 3,
      "creator": {
        "id": "uuid",
        "email": "creator@example.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      "images": [],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### GET /projects/search/suggestions
Get search suggestions for autocomplete.

**Query Parameters:**
- `q` (string, required): Search query (min 2 characters)
- `limit` (number, optional): Number of suggestions (default: 10)

**Response Format:**
```json
[
  {
    "text": "Education for All",
    "type": "title",
    "relevance_score": 0.9
  },
  {
    "text": "EDUCATION",
    "type": "category",
    "relevance_score": 0.8
  }
]
```

## Implementation Details

### Database Indexes
The following PostgreSQL GIN indexes are created for optimal search performance:

```sql
-- Title search index
CREATE INDEX idx_projects_title_fts 
ON projects USING GIN (to_tsvector('english', title));

-- Description search index
CREATE INDEX idx_projects_description_fts 
ON projects USING GIN (to_tsvector('english', description));

-- Combined search index
CREATE INDEX idx_projects_search_fts 
ON projects USING GIN (to_tsvector('english', title || ' ' || description));

-- Category search index
CREATE INDEX idx_projects_category_fts 
ON projects USING GIN (to_tsvector('english', category::text));
```

### Relevance Scoring
- **Title matches**: Weight A (highest priority)
- **Description matches**: Weight B (medium priority)
- **Category matches**: Weight C (lowest priority)
- **Match types**: 3 (title), 2 (description), 1 (category), 0 (no match)

### Performance Optimizations
- Uses PostgreSQL native full-text search
- GIN indexes for fast text search
- Efficient pagination with LIMIT/OFFSET
- Separate queries for counting and data retrieval
- Optimized joins for related data

## Usage Examples

### Basic Search
```bash
GET /projects?search=education
```

### Search with Filters
```bash
GET /projects?search=health&category=HEALTH&status=ACTIVE
```

### Search with Sorting
```bash
GET /projects?search=education&sortBy=relevance&sortOrder=desc
```

### Search with Pagination
```bash
GET /projects?search=education&page=2&limit=5
```

### Multiple Filters
```bash
GET /projects?categories=EDUCATION,HEALTH&statuses=ACTIVE,APPROVED
```

### Search Suggestions
```bash
GET /projects/search/suggestions?q=edu&limit=5
```

## Performance Metrics
- **Target Response Time**: <500ms
- **Index Usage**: Utilizes GIN indexes for fast text search
- **Scalability**: Handles thousands of projects efficiently
- **Memory Usage**: Optimized queries with proper indexing

## Testing
Run the search tests with:
```bash
npm test -- projects.search.spec.ts
```

## Future Enhancements
- Fuzzy search capabilities
- Search result highlighting
- Advanced search operators (AND, OR, NOT)
- Search analytics and tracking
- Search result caching
