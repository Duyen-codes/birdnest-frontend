import axios from 'axios'
import { useState, useEffect, useRef } from 'react'
import moment from 'moment'

import captureService from './services/captures'

// Material UI
import Card from '@mui/material/Card'
import EmailIcon from '@mui/icons-material/Email'
import ContactPhoneIcon from '@mui/icons-material/ContactPhone'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import Container from '@mui/material/Container'
import CardMedia from '@mui/material/CardMedia'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'

// calculate distance between each drone to NDZ (no drone zone) origin point (position 250000, 250000)
//
// to define which drones are violating the NDZ (no drone zone)
function isInsideNDZ(droneX, droneY, originX, originY, Radius) {
  const d =
    Radius -
    Math.sqrt(
      (droneX - originX) * (droneX - originX) +
        (droneY - originY) * (droneY - originY),
    )

  return d <= 0
}

// check time validity of every capture object

const isTimeValid = (today, snapshotTimestamp) => {
  let snapshotDate = new Date(snapshotTimestamp)
  let diff = today.getTime() - snapshotDate.getTime()

  let diffInMinutes = Math.ceil(diff / 60000)

  return diffInMinutes <= 10 // from the last 10minutes only
}

// const momentAgo = (snapshotTimestamp) => {
//   const snapshotDate = new Date(snapshotTimestamp)

//   return moment(snapshotDate).fromNow()
// }

function droneToNestDistance(droneX, droneY, originX, originY) {
  return Math.sqrt(
    (droneX - originX) * (droneX - originX) +
      (droneY - originY) * (droneY - originY),
  )
}

function App() {
  const [captureData, setCaptureData] = useState([])

  const [violatingPilots, setViolatingPilots] = useState([])
  const [recentSavedCapture, setRecentSavedCapture] = useState([])
  const [recentPilots, setRecentPilots] = useState([])

  const [progress, setProgress] = useState(10)

  const Radius = 100
  const originX = 250000
  const originY = 250000
  const today = new Date()
  let confirmedClosestDist = useRef(0)

  useEffect(() => {
    let interval = setInterval(() => {
      captureService.getAll().then((data) => {
        setCaptureData(data?.captures)

        setRecentSavedCapture(data?.recentSavedCapture)

        // filter out captureData that is valid (from the last 10 minutes)
        let validCaptures = captureData.filter((capture) => {
          return isTimeValid(today, capture?.snapshotTimestamp)
        })

        // filter the captureData array which is an arr of capture objects{snapshotTimestamp: '', drone: []} to get new arr of captures with only violating drones

        const capturesWithViolatingDrones = validCaptures?.map(
          (captureObject) => {
            let filteredDroneArr = captureObject.drone.filter((drone) => {
              return isInsideNDZ(
                drone.positionX,
                drone.positionY,
                originX,
                originY,
                Radius,
              )
            }) // filter ends here

            return { ...captureObject, drone: filteredDroneArr }
          },
        ) // map ends here

        const recentViolatingDrones = recentSavedCapture?.drone?.filter(
          (drone) =>
            isInsideNDZ(
              drone.positionX,
              drone.positionY,
              originX,
              originY,
              Radius,
            ),
        )
        // create an array of violating drones from all captureData that has violating drones

        const violatingDroneList = capturesWithViolatingDrones.reduce(
          (accumulator, currentValue) => {
            return [...accumulator, ...currentValue.drone]
          },
          [],
        )

        const uniqueViolatingDrones = violatingDroneList.reduce(
          (accumulator, currentValue) => {
            const found = accumulator.find((item) => {
              return item.serialNumber[0] === currentValue.serialNumber[0]
            })

            if (!found) {
              return [...accumulator, currentValue]
            }
            return accumulator
          },
          [],
        )

        // array of distance, use Math.min to find the closest confirmed distance drone-nest
        const distanceList = uniqueViolatingDrones.map((drone) => {
          return droneToNestDistance(
            drone.positionX,
            drone.positionY,
            originX,
            originY,
          )
        })

        confirmedClosestDist.current = Math.min(...distanceList)

        // create pilot links for fetching violating pilot info
        // expected output is an arr of link with serialNumber param

        const pilotFetchLinksList = uniqueViolatingDrones.map(
          (drone) => `/api/pilots/${drone.serialNumber}`,
        )

        // recentPilotLinks from recentSavedCapture
        const recentPilotLinks = recentSavedCapture?.drone?.map(
          (droneObject) => `/api/pilots/${droneObject.serialNumber}`,
        )

        // check if violatingPilots are fetched already
        if (violatingPilots.length === 0) {
          // fetch all pilots for the first time
          axios.all(pilotFetchLinksList.map((link) => axios.get(link))).then(
            axios.spread(function (...responses) {
              const allPilots = responses.reduce(
                (accumulator, currentResponse) => {
                  return accumulator.concat(currentResponse.data)
                },
                [],
              )

              setViolatingPilots(allPilots)
            }),
          )
        } else {
          // only fetch info of new added pilots

          axios.all(recentPilotLinks.map((link) => axios.get(link))).then(
            axios.spread(function (...responses) {
              const recentPilots = responses.reduce(
                (accumulator, currentResponse) => {
                  return accumulator.concat(currentResponse.data)
                },
                [],
              )

              // remove duplicates when combining existing violatingPilots list with recentPilots list
              const uniquePilots = recentPilots
                .concat(violatingPilots)
                .reduce((accumulator, currentPilotObject) => {
                  const found = accumulator.find((item) => {
                    return item.pilotId === currentPilotObject.pilotId
                  })

                  if (!found) {
                    return [...accumulator, currentPilotObject]
                  }
                  return accumulator
                }, [])

              setViolatingPilots(uniquePilots)
            }),
          )
        }
      })
    }, 2000)

    return () => {
      clearInterval(interval)
    }
  }, [violatingPilots])
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prevProgress) =>
        prevProgress >= 100 ? 0 : prevProgress + 10,
      )
    }, 800)

    return () => {
      clearInterval(timer)
    }
  }, [])

  if (violatingPilots.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress variant="determinate" value={progress} />
      </Box>
    )
  }

  return (
    <div className="App">
      <div style={{ textAlign: 'center' }}>
        <Typography
          variant="h2"
          sx={{ textAlign: 'center', fontWeight: 'medium' }}
        >
          {' '}
          Birdnest app
        </Typography>
        <Typography variant="h5">
          Pilots whose drones violate NDZ from the last 10 minutes:
        </Typography>
        <p>
          Confirmed closet distance to the nest: {confirmedClosestDist.current}{' '}
        </p>
        <p>Total violating pilots: {violatingPilots.length}</p>
      </div>
      <Grid container spacing={2}>
        {violatingPilots.map((pilot, index) => (
          <Grid item key={index} xs={12} sm={6} md={4}>
            <Card>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography
                  gutterBottom
                  variant="h5"
                  component="h2"
                  sx={{ fontWeight: 'medium' }}
                >
                  {' '}
                  {pilot.firstName} {pilot.lastName}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <IconButton>
                    <ContactPhoneIcon color="primary" />
                  </IconButton>

                  <p> {pilot.phoneNumber}</p>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <IconButton>
                    <EmailIcon color="primary" />
                  </IconButton>
                  <p>{pilot.email}</p>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  )
}

export default App
