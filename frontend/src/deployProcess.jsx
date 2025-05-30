import React, { useEffect , useState } from 'react';
import { Typography } from '@mui/material';
import axios from 'axios'
function deployProcess() {
  const [runningProcess , setRunningProcess] = useState([]);
  useEffect(() => {
    axios.get('http://localhost:3000/process/getAll').then(res => {
      setRunningProcess(res.data)
    })
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Second Page
      </Typography>
      {runningProcess.map((process,index) => (
        <Typography key={index} variant="body1">
          {process}
        </Typography>
      ))}
      {/* <Typography variant="body1">
        This is a placeholder page for navigation demonstration.
      </Typography> */}
    </div>
  );
}

export default deployProcess;
