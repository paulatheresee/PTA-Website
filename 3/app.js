const express = require('express');
const path = require('path');
const multer = require('multer');
const hbs = require('hbs');
const session = require('express-session'); // Import express-session
const app = express();

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const port = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded data

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configure express-session
app.use(session({
  secret: 'your_secret_key', // Replace with a secure secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Set up Handlebars view engine
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to fetch and display data on the index page
app.get('/', async (req, res) => {
  try {
    // Fetch users data
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (usersError) {
      return res.status(400).json({ error: usersError.message });
    }

    // Fetch athletes data
    const { data: athletes, error: athletesError } = await supabase
      .from('athletes')
      .select('*');

    if (athletesError) {
      return res.status(400).json({ error: athletesError.message });
    }

    console.log("Fetched users data:", users); // Log the users data to the console
    console.log("Fetched athletes data:", athletes); // Log the athletes data to the console

    // Render the index.hbs template with the fetched data
    res.render('index', { users, athletes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Example route to get a specific row from Supabase and log it
app.get('/data/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single(); // single() ensures we get a single row

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/submit-login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password) //blue is from form and red is column in databse
      .single(); // Ensure a single match

    if (error || !data) {
      // Invalid credentials
      return res.status(401).render('index', {
        error: 'Invalid username or password.',
        users: [], // Pass users array if needed
        athletes: [] // Pass athletes array if needed
      });
    }

    // Store user information in session
    req.session.user = {
      id: data.id,
      firstname: data.firstname,
      lastname: data.lastname,
      username: data.username,
      password: data.password,
      usertype: data.usertype,
      club: data.club,
      region: data.region,
      registered: data.registered,
      profilepic: data.profilepic
    };

    // Successful login
    res.redirect('/home');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/submit-ncc', async (req, res) => {
  const {
    firstname,
    mi,
    lastname,
    gender,
    bday,
    phonenum,
    email,
    lastpromo,
    promolocation,
    clubregion,
    clubname,
    beltlevel,
    instructorfirstname,
    instructormi,
    instructorlastname,
    instructormobile,
    instructoremail
  } = req.body; // Capture user input from the form

  if (!req.session.user) {
    return res.status(401).send('Unauthorized: No user logged in');
  }

  const submittedby = req.session.user.username; // Get the current user's username from the session

  try {
    // Insert the new user into the database
    const { data, error } = await supabase
      .from('ncc_registrations') // Replace 'users' with your actual table name if different
      .insert([{
        firstname,
        mi,
        lastname,
        gender,
        bday,
        phonenum,
        email,
        lastpromo,
        promolocation,
        clubregion,
        clubname,
        beltlevel,
        instructorfirstname,
        instructormi,
        instructorlastname,
        instructormobile,
        instructoremail,
        submittedby // Include the current user's username
      }]);

    if (error) {
      // Handle any errors that occur during the insert
      return res.status(500).render('index', {
        error: 'Error creating registration.',
        users: [] // Optionally pass users array if you need it in the view
      });
    }
    res.redirect('/membership');
  } catch (error) {
    // Handle any server-side errors
    res.status(500).json({ error: error.message });
  }
});


app.post('/submit-signup', async (req, res) => {
  const { username, password, confpassword } = req.body; // Capture user input from the form

  // Validate the input
  if (password !== confpassword) {
    return res.status(400).render('index', {
      error: 'Passwords do not match.',
      users: [] // Optionally pass users array if you need it in the view
    });
  }

  try {
    // Insert the new user into the database
    const { data, error } = await supabase
      .from('users') // Replace 'users' with your actual table name if different
      .insert([{ username, password }]);

    if (error) {
      // Handle any errors that occur during the insert
      return res.status(500).render('index', {
        error: 'Error creating user.',
        users: [] // Optionally pass users array if you need it in the view
      });
    }

    // Redirect to the login page after successful signup
    res.redirect('/');
  } catch (error) {
    // Handle any server-side errors
    res.status(500).json({ error: error.message });
  }
});

// Route to render the home page and display the logged-in user's name
app.get('/home', async function (req, res) {
  if (!req.session.user) {
    return res.redirect('/');
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console 

    // Render the home.hbs template with both the fetched data and the session user data
    res.render('home', { events: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/forum', async function (req, res) {
  if (!req.session.user) {
    return res.redirect('/');
  }

  try {
    const { data, error } = await supabase
      .from('forumthreads')
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console 

    // Render the forum.hbs template with the fetched data
    res.render('forum', { forumthreads: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/clubs', async function (req, res) {
  if (!req.session.user) {
    return res.redirect('/');
  }

  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console 

    // Render the forum.hbs template with the fetched data
    res.render('clubs', { clubs: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/membership', async function (req, res) {
  if (!req.session.user) {
    return res.redirect('/');
  }

  try {
    const { data, error } = await supabase
      .from('clubs')                                            //need to change to clubs after
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console 

    // Render the forum.hbs template with the fetched data
    res.render('membership', { clubs: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message, user: req.session.user });
  }
});

app.get('/events', async function (req, res) {
  if (!req.session.user) {
    return res.redirect('/');
  }

  try {
    const { data, error } = await supabase
      .from('events')                                            //need to change to clubs after
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console 

    // Render the forum.hbs template with the fetched data
    res.render('events', { events: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/profile', async function (req, res) {
  if (!req.session.user) {
    return res.redirect('/');
  }

  res.render('profile', { user: req.session.user });
});

app.get('/athletes', async function (req, res) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  try {
    const { data, error } = await supabase
      .from('athletes')
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console 

    // Render the athletes.hbs template with the fetched data
    res.render('athletes', { athletes: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

                                                                        //MEMBERSHIP PAGES

app.get('/membership-ncc', async function (req, res) {
  if (!req.session.user) {
    return res.redirect('/');
  }

  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console 

    // Render the athletes.hbs template with the fetched data
    res.render('membership-ncc', { clubs: data, user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/membership-status', async function (req, res) {
  if (!req.session.user) {
    return res.redirect('/');
  }

  const username = req.session.user.username; // Or use a unique identifier like user ID

  try {
    const { data, error } = await supabase
      .from('ncc_registrations')
      .select('*')
      .eq('submittedby', username); // Filter by the current user's username

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log("Fetched data:", data); // Log the data to the console 

    // Render the home.hbs template with the filtered data
    res.render('membership-status', { user: req.session.user, ncc_registrations: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//profile picture thing
// app.post('/submit-user', upload.single('profile_picture'), async (req, res) => {
//   const {
//     username,
//     password,
//     email
//     // Other user fields
//   } = req.body; // Capture user input from the form

//   try {
//     // Handle profile picture upload
//     let profilePictureUrl = '';
//     if (req.file) {
//       const profilePicture = req.file;
//       const filePath = `profile-pictures/${Date.now()}-${profilePicture.originalname}`;
//       const { data, error: uploadError } = await supabase
//         .storage
//         .from('images') // Ensure you have a bucket named 'images' in Supabase Storage
//         .upload(filePath, profilePicture.buffer, {
//           contentType: profilePicture.mimetype,
//           upsert: true,
//         });

//       if (uploadError) {
//         console.error('Error uploading profile picture:', uploadError.message);
//         return res.status(500).send('Error uploading profile picture');
//       }

//       profilePictureUrl = `${supabaseUrl}/storage/v1/object/public/images/${filePath}`;
//     }

//     // Insert user data into the database
//     const { data, error } = await supabase
//       .from('users')
//       .insert([{
//         username,
//         password,
//         email,
//         profile_picture_url: profilePictureUrl // Save the profile picture URL
//       }]);

//     if (error) {
//       console.error('Error inserting user data:', error.message);
//       return res.status(500).send('Error creating user');
//     }

//     res.redirect('/somewhere'); // Redirect to a success page or the user profile page
//   } catch (error) {
//     console.error('Server error:', error.message);
//     res.status(500).send('Server error');
//   }
// });

