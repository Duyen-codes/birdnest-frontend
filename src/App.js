import axios from "axios";
import { useState, useEffect } from "react";

function App() {
	const [initialDrones, setInitialDrones] = useState([]);
	const Radius = 100;
	const originX = 250000;
	const originY = 250000;

	useEffect(() => {
		axios.get("http://localhost:3001/api/drones").then((response) => {
			console.log(
				"response.data.report.capture[0].drone",
				response.data.report.capture[0].drone,
			);
			setInitialDrones(response.data.report.capture[0].drone);
		});
	}, []);

	console.log("initialDrones", initialDrones);

	// calculate distance between each drone to nfz origin point (position 250000, 250000)
	//
	// to define which drones are violating the nfz

	function isInsideNFZ(droneX, droneY, originX, originY, radius) {
		const d =
			radius -
			Math.sqrt(
				(droneX - originX) * (droneX - originX) +
					(droneY - originY) * (droneY - originY),
			);

		return d <= 0;
	}

	function droneToNestDistance(a, b) {
		return Math.sqrt((a - 250000) * (a - 250000) + (b - 250000) * (b - 250000));
	}

	const violatingDrones = initialDrones.filter((drone) => {
		console.log("drone", drone);
		let result = isInsideNFZ(
			drone.positionX,
			drone.positionY,
			originX,
			originY,
			Radius,
		);

		console.log("result", result);

		if (result) {
			return drone;
		}
	});

	console.log("violatingDrones", violatingDrones);

	return (
		<div className='App'>
			<h1> birdnest app</h1>
			<h3>Drones violating NFZ</h3>
			<ol>
				{violatingDrones.map((drone, index) => (
					<li key={index}>
						<p>serialNumber: {drone.serialNumber} </p>
						<p>positionX: {drone.positionX}</p>
						<p>positionY: {drone.positionY}</p>
						<p>
							Distance from drone to nest:{" "}
							{droneToNestDistance(drone.positionX, drone.positionY)}
						</p>
					</li>
				))}
			</ol>
		</div>
	);
}

export default App;
