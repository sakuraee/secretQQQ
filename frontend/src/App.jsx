import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AppBar, Toolbar, Button } from '@mui/material';
import Home from './Home';
import DeployProcess  from './deployProcess';

function App() {
  return (
    <Router>
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" component={Link} to="/">
            Home
          </Button>
          <Button color="inherit" component={Link} to="/deployProcess">
            Second Page
          </Button>
        </Toolbar>
      </AppBar>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/deployProcess" element={<DeployProcess />} />
      </Routes>
    </Router>
  );
}

export default App;
