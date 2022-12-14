import axios from 'axios'
import { useState, useEffect, useRef } from 'react'
import moment from 'moment'

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
  // console.log('today', today)
  let snapshotDate = new Date(snapshotTimestamp)
  let diff = today.getTime() - snapshotDate.getTime()
  // console.log('diff', diff)
  let diffInMinutes = Math.ceil(diff / 60000)
  // console.log('diffInMinutes', diffInMinutes)

  return diffInMinutes <= 10 // from the last 10minutes only
}

const momentAgo = (snapshotTimestamp) => {
  const snapshotDate = new Date(snapshotTimestamp)

  return moment(snapshotDate).fromNow()
}

function droneToNestDistance(droneX, droneY, originX, originY) {
  return Math.sqrt(
    (droneX - originX) * (droneX - originX) +
      (droneY - originY) * (droneY - originY),
  )
}

function App() {
  const [captureData, setCaptureData] = useState([])
  const [validCaptures, setValidCaptures] = useState([])
  const [violatingPilots, setViolatingPilots] = useState([])
  const [recentSavedCapture, setRecentSavedCapture] = useState([])
  const [recentPilots, setRecentPilots] = useState([])

  const Radius = 100
  const originX = 250000
  const originY = 250000
  const today = new Date()
  let confirmedClosestDist = useRef(0)
  console.log('App rendering...')
  console.log('violatingPilots...', violatingPilots)

  useEffect(() => {
    console.log('useEffect...')

    let interval = setInterval(() => {
      axios.get('http://localhost:3001/api/drones').then((response) => {
        // console.log('response', response)
        // console.log(
        //   'response.data.report.capture[0]',
        //   response.data.report.capture[0],
        // )

        // setCaptureData(captureData.concat(response.data.report.capture[0]))
        setCaptureData(response?.data?.dataToReturn)

        console.log('captureData', captureData)

        setRecentSavedCapture(response?.data?.recentSavedCapture)

        console.log('recentSavedCapture', recentSavedCapture)

        // filter out captureData that is valid (from the last 10 minutes)
        let validCaptures = captureData.filter((capture) => {
          return isTimeValid(today, capture?.snapshotTimestamp)
        })

        setValidCaptures(validCaptures)

        console.log('validCaptures', validCaptures)

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
        // create an array of violating drones

        const violatingDroneList = capturesWithViolatingDrones.reduce(
          (accumulator, currentValue) => {
            return [...accumulator, ...currentValue.drone]
          },
          [],
        )
        const uniqueViolatingDrones = violatingDroneList.reduce(
          (accumulator, currentValue) => {
            const found = accumulator.find((item) => {
              // console.log('item.serialNumber', item.serialNumber)
              // console.log(
              //   'currentValue.serialNumber',
              //   currentValue.serialNumber,
              // )
              return item.serialNumber[0] === currentValue.serialNumber[0]
            })
            // console.log('found', found)
            if (!found) {
              return [...accumulator, currentValue]
            }
            return accumulator
          },
          [],
        )
        // console.log('uniqueViolatingDrones', uniqueViolatingDrones)

        // array of distance, use Math.min to fine the closet confirmed distance drone-nest
        const distanceList = uniqueViolatingDrones.map((drone) => {
          return droneToNestDistance(
            drone.positionX,
            drone.positionY,
            originX,
            originY,
          )
        })

        // console.log('distanceList', distanceList)

        confirmedClosestDist.current = Math.min(...distanceList)
        // console.log('confirmedClosestDist', confirmedClosestDist)

        // create pilot links for fetching violating pilot info
        // expected output is an arr of link with serialNumber param

        const pilotFetchLinksList = uniqueViolatingDrones.map(
          (drone) => `http://localhost:3001/api/pilots/${drone.serialNumber}`,
        )

        // recentPilotLinks
        const recentPilotLinks = recentSavedCapture?.drone?.map(
          (droneObject) =>
            `http://localhost:3001/api/pilots/${droneObject.serialNumber}`,
        )

        // check if violatingPilots are fetched already
        if (violatingPilots.length === 0) {
          console.log('if block...')
          // fetch pilots info
          axios.all(pilotFetchLinksList.map((link) => axios.get(link))).then(
            axios.spread(function (...responses) {
              // console.log('responses', responses)

              const allPilots = responses.reduce(
                (accumulator, currentResponse) => {
                  // console.log('accumulator', accumulator)
                  // console.log('currentValue', currentValue)

                  return accumulator.concat(currentResponse.data)
                },
                [],
              )

              // console.log('allPilotsArr', allPilots)
              setViolatingPilots(allPilots)
              console.log('if block violatingPilots...', violatingPilots)
            }),
          )
        } else {
          // only fetch info of new added pilots
          console.log('else block...')
          axios.all(recentPilotLinks.map((link) => axios.get(link))).then(
            axios.spread(function (...responses) {
              // console.log('responses', responses)

              const recentPilots = responses.reduce(
                (accumulator, currentResponse) => {
                  return accumulator.concat(currentResponse.data)
                },
                [],
              )

              // console.log('recentPilots', recentPilots)

              // remove duplicates when combining existing violatingPilots list with recentPilots list
              const uniquePilots = violatingPilots
                .concat(recentPilots)
                .reduce((accumulator, currentPilotObject) => {
                  const found = accumulator.find((item) => {
                    return item.pilotId === currentPilotObject.pilotId
                  })

                  if (!found) {
                    return [...accumulator, currentPilotObject]
                  }
                  return accumulator
                }, [])

              // console.log('uniquePilots', uniquePilots)
              setViolatingPilots(uniquePilots)
            }),
          )
        }
        // console.log('recentPilotLinks', recentPilotLinks)

        console.log('capturesWithViolatingDrones', capturesWithViolatingDrones)
        console.log('violatingPilots', violatingPilots)
      })
    }, 2000)

    return () => {
      clearInterval(interval)
    }
  }, [violatingPilots])

  if (violatingPilots.length === 0) {
    return <p>loading...</p>
  }

  console.log('violatingPilots', violatingPilots)
  return (
    <div className="App">
      <h1> birdnest app</h1>
      <h3>Pilots whose drones violate NDZ from the last 10 minutes</h3>
      <p>
        Confirmed closet distance to the nest: {confirmedClosestDist.current}{' '}
      </p>
      <p>Number of violating pilots: {violatingPilots.length}</p>
      <ol>
        {violatingPilots.map((pilot, index) => (
          <li key={index}>
            <p>
              {' '}
              {pilot.firstName} {pilot.lastName}
            </p>
            <p>phone: {pilot.phoneNumber}</p>
            <p>Email: {pilot.email}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default App
