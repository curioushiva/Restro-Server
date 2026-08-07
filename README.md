# 🍽️ Restro Server  

A minimal **Node.js + Express** backend powering the Restro App. It’s inspired by [`Mr Chetan Nadda’s FoodFire Server`](https://github.com/chetannada/FoodFire-Server) and extended with extra endpoints like **location autocomplete** and **geo lookup** to enhance restaurant discovery.  

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🛠 Features  
- Restaurant listings by latitude & longitude  
- Detailed restaurant menus  
- Place autocomplete (search as you type)  
- Address/Geo lookup via place ID  
- Modular Express structure  

<hr style="height:3px; border:none; background-color:#3D444D;">

## ⚡ Setup & Installation  

### 1. Clone this repo  
```bash
git clone https://github.com/curioushiva/restro-server.git
cd restro-server
```

### 2. Install dependencies  
```bash
npm install
```

### 3. Configure environment variables  
```bash
PORT=5000

SWIGGY_RESTAURANT_API=https://www.swiggy.com/dapi/restaurants/list/v5
SWIGGY_MENU_API=https://www.swiggy.com/dapi/menu/pl
SWIGGY_LOC_API=https://www.swiggy.com/dapi/misc/place-autocomplete?input=
SWIGGY_GEO_API=https://www.swiggy.com/dapi/misc/address-recommend?place_id=
```

### 4. Start the server  
```bash
npm run start
```

Runs locally at → [http://localhost:5000](http://localhost:5000)  

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🔗 Example Usage  

Fetch restaurants near a location:  
```javascript
const response = await fetch(
    "http://localhost:5000/api/restaurants?lat=12.9351929&lng=77.62448069999999&page_type=DESKTOP_WEB_LISTING"
);
const data = await response.json();
```

<hr style="height:3px; border:none; background-color:#3D444D;">

## ☁️ Deployment  

1. Push this repo to your GitHub.  
2. Deploy on **Render** (or any Node hosting).  
3. Add the **.env variables** in the hosting dashboard.  
4. Update your Restro frontend to use your deployed server URL:  

```javascript
const response = await fetch(
    "https://your-restro-server.onrender.com/api/restaurants?lat=12.93&lng=77.62"
);
```

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🙏 Acknowledgments  
Special thanks to [`Mr Chetan Nadda`](https://github.com/chetannada) for his excellent work on the  [`FoodFire Server`](https://github.com/chetannada/FoodFire-Server) which served as the foundation and inspiration for building Restro Server.  

<hr style="height:3px; border:none; background-color:#3D444D;">

## 👨‍💻 Author  
Built with <3 by **[`Curiosuhiva`](https://www.instagram.com/curioushiva/)** to power the Restro App.  
