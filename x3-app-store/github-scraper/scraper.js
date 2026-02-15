const axios = require('axios');
const mongoose = require('mongoose');
const cron = require('node-cron');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/x3-app-store', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Models
const projectSchema = new mongoose.Schema({
  name: String,
  description: String,
  language: String,
  githubUrl: String,
  stars: Number,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

const Project = mongoose.model('Project', projectSchema);

// GitHub API configuration
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'your_github_token_here';

// Search for crypto-related projects
const searchCryptoProjects = async () => {
  try {
    console.log('Searching for crypto projects...');

    const searchQuery = 'crypto airdrop farming mining defi yield';
    const response = await axios.get(`${GITHUB_API_URL}/search/repositories`, {
      params: {
        q: searchQuery,
        sort: 'stars',
        order: 'desc',
        per_page: 100,
      },
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const repos = response.data.items;
    console.log(`Found ${repos.length} repositories`);

    for (const repo of repos) {
      const existingProject = await Project.findOne({ githubUrl: repo.html_url });
      if (!existingProject) {
        const project = new Project({
          name: repo.name,
          description: repo.description,
          language: repo.language,
          githubUrl: repo.html_url,
          stars: repo.stargazers_count,
        });
        await project.save();
        console.log(`Added new project: ${repo.name}`);
      }
    }

    console.log('GitHub search completed');
  } catch (error) {
    console.error('Error searching GitHub:', error.message);
  }
};

// Schedule regular searches
cron.schedule('0 */6 * * *', () => {
  searchCryptoProjects();
});

// Initial search
searchCryptoProjects();

console.log('GitHub scraper started');