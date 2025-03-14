
import { Hono } from 'hono';
import { z } from 'zod';

type Movie = {
  id: string;
  title: string;
  director: string;
  releaseYear: number;
  genre: string;
  ratings: number[];
};

const movies: Map<string, Movie> = new Map();

const app = new Hono();

const validateMovieId = async (c: any, next: any) => {
  const id = c.req.param('id');
  if (!movies.has(id)) {
    return c.json({ error: 'Movie not found' }, 404);
  }
  await next();
};

const movieSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  director: z.string().min(1),
  releaseYear: z.number().int().min(1888).max(new Date().getFullYear() + 5),
  genre: z.string().min(1),
});

const updateMovieSchema = z.object({
  title: z.string().min(1).optional(),
  director: z.string().min(1).optional(),
  releaseYear: z.number().int().min(1888).max(new Date().getFullYear() + 5).optional(),
  genre: z.string().min(1).optional(),
});

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

app.post('/movies', async (c) => {
  try {
    const body = await c.req.json();
    
    const result = movieSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Invalid movie data', details: result.error.issues }, 400);
    }
    
    const movie = result.data;
    
    if (movies.has(movie.id)) {
      return c.json({ error: 'Movie with this ID already exists' }, 400);
    }
    
    movies.set(movie.id, { ...movie, ratings: [] });
    
    return c.json({ message: 'Movie added successfully', movie }, 201);
  } catch (error) {
    return c.json({ error: 'Invalid request body' }, 400);
  }
});

app.patch('/movies/:id', validateMovieId, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const result = updateMovieSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Invalid update data', details: result.error.issues }, 400);
    }
    
    const updateData = result.data;
    const existingMovie = movies.get(id)!;
    
    const updatedMovie = {
      ...existingMovie,
      ...updateData
    };
    
    movies.set(id, updatedMovie);
    
    return c.json({ message: 'Movie updated successfully', movie: updatedMovie });
  } catch (error) {
    return c.json({ error: 'Invalid request body' }, 400);
  }
});

app.get('/movies/:id', validateMovieId, (c) => {
  const id = c.req.param('id');
  const movie = movies.get(id);
  
  return c.json(movie);
});

app.delete('/movies/:id', validateMovieId, (c) => {
  const id = c.req.param('id');
  movies.delete(id);
  
  return c.json({ message: 'Movie deleted successfully' });
});

app.post('/movies/:id/rating', validateMovieId, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const result = ratingSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: 'Invalid rating data. Rating must be between 1 and 5', details: result.error.issues }, 400);
    }
    
    const { rating } = result.data;
    const movie = movies.get(id)!;
    
    movie.ratings.push(rating);
    movies.set(id, movie);
    
    return c.json({ message: 'Movie rated successfully', movie });
  } catch (error) {
    return c.json({ error: 'Invalid request body' }, 400);
  }
});

app.get('/movies/:id/rating', validateMovieId, (c) => {
  const id = c.req.param('id');
  const movie = movies.get(id)!;
  
  if (movie.ratings.length === 0) {
    return c.json({ message: 'Movie has no ratings yet' }, 204);
  }
  
  const avgRating = movie.ratings.reduce((sum, rating) => sum + rating, 0) / movie.ratings.length;
  
  return c.json({ movieId: id, averageRating: parseFloat(avgRating.toFixed(1)), totalRatings: movie.ratings.length });
});

app.get('/movies/top-rated', (c) => {
  const movieList = Array.from(movies.values());
  
  if (movieList.length === 0) {
    return c.json({ error: 'No movies found' }, 404);
  }
  
  const moviesWithRatings = movieList.map(movie => {
    const avgRating = movie.ratings.length > 0 
      ? movie.ratings.reduce((sum, rating) => sum + rating, 0) / movie.ratings.length 
      : 0;
    
    return {
      ...movie,
      averageRating: parseFloat(avgRating.toFixed(1))
    };
  });
  
  const sortedMovies = moviesWithRatings.sort((a, b) => b.averageRating - a.averageRating);
  
  return c.json(sortedMovies);
});

app.get('/movies/genre/:genre', (c) => {
  const genre = c.req.param('genre').toLowerCase();
  const movieList = Array.from(movies.values());
  
  const filteredMovies = movieList.filter(movie => 
    movie.genre.toLowerCase() === genre
  );
  
  if (filteredMovies.length === 0) {
    return c.json({ error: 'No movies found for this genre' }, 404);
  }
  
  return c.json(filteredMovies);
});

app.get('/movies/director/:director', (c) => {
  const director = c.req.param('director').toLowerCase();
  const movieList = Array.from(movies.values());
  
  const filteredMovies = movieList.filter(movie => 
    movie.director.toLowerCase() === director
  );
  
  if (filteredMovies.length === 0) {
    return c.json({ error: 'No movies found for this director' }, 404);
  }
  
  return c.json(filteredMovies);
});

app.get('/movies/search', (c) => {
  const keyword = c.req.query('keyword')?.toLowerCase();
  
  if (!keyword) {
    return c.json({ error: 'Keyword parameter is required' }, 400);
  }
  
  const movieList = Array.from(movies.values());
  
  const filteredMovies = movieList.filter(movie => 
    movie.title.toLowerCase().includes(keyword)
  );
  
  if (filteredMovies.length === 0) {
    return c.json({ error: 'No movies found matching the keyword' }, 404);
  }
  
  return c.json(filteredMovies);
});

// Start the server
const port = 3000;
console.log(`Server is running on port ${port}`);

export default {
  port,
  fetch: app.fetch
};