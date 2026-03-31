import {
	BufferGeometry,
	Vector3,
	Float32BufferAttribute,
} from 'three';

// RoundedBoxGeometry
// Original author: prisoner849 (https://discourse.threejs.org/u/prisoner849)
// Source: https://discourse.threejs.org/t/three-js-rounded-box/2448

export class RoundedBoxGeometry extends BufferGeometry {
	public type: string;
	public parameters: {
		width: number;
		height: number;
		depth: number;
		segments: number;
		radius: number;
	};

	constructor( width = 1, height = 1, depth = 1, segments = 2, radius = 0.1 ) {

		super();
		this.type = 'RoundedBoxGeometry';

		this.parameters = {
			width: width,
			height: height,
			depth: depth,
			segments: segments,
			radius: radius
		};


		// helper variables
		width = width / 2 - radius;
		height = height / 2 - radius;
		depth = depth / 2 - radius;

		radius = Math.min( radius, width, height, depth );


		const pi2 = Math.PI * 2;

		// FIX: Explicitly type arrays to avoid potential type inference issues with the 'three' library.
		const positions: number[] = [];
		const normals: number[] = [];
		const uvs: number[] = [];
		let indices: number[] = [];

		const p = new Vector3();
		const n = new Vector3();

		// corners
		const cornerVerts: number[] = [];
		const cornerNormals: number[] = [];

		for ( let i = 0; i < ( segments + 1 ) * ( segments + 1 ); i ++ ) {
			cornerVerts.push( 0, 0, 0 );
			cornerNormals.push( 0, 0, 0 );
		}

		let s1 = segments + 1;
		let s2 = segments + 1;

		for ( let j = 0; j < s1; j ++ ) {
			for ( let i = 0; i < s2; i ++ ) {
				let u = i / segments;
				let v = j / segments;

				let phi = pi2 * u / 4;
				let theta = pi2 * v / 4;

				n.set(
					Math.cos( phi ) * Math.cos( theta ),
					Math.sin( phi ) * Math.cos( theta ),
					Math.sin( theta )
				);

				p.copy( n ).multiplyScalar( radius );

				let index = j * s2 + i;

				cornerVerts[ index * 3 + 0 ] = p.x;
				cornerVerts[ index * 3 + 1 ] = p.y;
				cornerVerts[ index * 3 + 2 ] = p.z;

				cornerNormals[ index * 3 + 0 ] = n.x;
				cornerNormals[ index * 3 + 1 ] = n.y;
				cornerNormals[ index * 3 + 2 ] = n.z;
			}
		}


		let cornerLayout = [
			{ x: 1, y: 1, z: 1, u: - 1, v: - 1, w: - 1, rot: 0 },
			{ x: 1, y: 1, z: - 1, u: - 1, v: - 1, w: 1, rot: Math.PI / 2 },
			{ x: - 1, y: 1, z: - 1, u: 1, v: - 1, w: 1, rot: Math.PI },
			{ x: - 1, y: 1, z: 1, u: 1, v: - 1, w: - 1, rot: - Math.PI / 2 },
			{ x: 1, y: - 1, z: 1, u: - 1, v: 1, w: - 1, rot: Math.PI / 2 },
			{ x: 1, y: - 1, z: - 1, u: - 1, v: 1, w: 1, rot: Math.PI },
			{ x: - 1, y: - 1, z: - 1, u: 1, v: 1, w: 1, rot: - Math.PI / 2 },
			{ x: - 1, y: - 1, z: 1, u: 1, v: 1, w: - 1, rot: 0 }
		];

		for ( let i = 0; i < 8; i ++ ) {
			let layout = cornerLayout[ i ];
			let cornerIndex = positions.length / 3;

			for ( let j = 0; j < cornerVerts.length / 3; j ++ ) {
				let index = j * 3;
				let x = cornerVerts[ index + 0 ];
				let y = cornerVerts[ index + 1 ];
				let z = cornerVerts[ index + 2 ];

				let nx = cornerNormals[ index + 0 ];
				let ny = cornerNormals[ index + 1 ];
				let nz = cornerNormals[ index + 2 ];

				let v = new Vector3( x, y, z );
				let n = new Vector3( nx, ny, nz );

				if ( layout.rot !== 0 ) v.applyAxisAngle( new Vector3( 0, 0, 1 ), layout.rot );
				if ( layout.rot !== 0 ) n.applyAxisAngle( new Vector3( 0, 0, 1 ), layout.rot );

				v.x *= layout.u;
				v.y *= layout.v;
				v.z *= layout.w;

				n.x *= layout.u;
				n.y *= layout.v;
				n.z *= layout.w;

				v.x += width * layout.x;
				v.y += height * layout.y;
				v.z += depth * layout.z;

				positions.push( v.x, v.y, v.z );
				normals.push( n.x, n.y, n.z );
			}

			for ( let j = 0; j < segments; j ++ ) {
				for ( let i = 0; i < segments; i ++ ) {
					let i1 = cornerIndex + j * s2 + i;
					let i2 = cornerIndex + j * s2 + i + 1;
					let i3 = cornerIndex + ( j + 1 ) * s2 + i + 1;
					let i4 = cornerIndex + ( j + 1 ) * s2 + i;

					indices.push( i1, i2, i4 );
					indices.push( i2, i3, i4 );
				}
			}
		}


		// edges
		let edgeLayout = [
			{ x: 1, y: 1, z: 0, u: 0, v: 1, w: 1, dir: 'y' },
			{ x: 1, y: - 1, z: 0, u: 0, v: - 1, w: 1, dir: 'y' },
			{ x: - 1, y: 1, z: 0, u: 0, v: 1, w: - 1, dir: 'y' },
			{ x: - 1, y: - 1, z: 0, u: 0, v: - 1, w: - 1, dir: 'y' },
			{ x: 1, y: 0, z: 1, u: 1, v: 0, w: 1, dir: 'z' },
			{ x: 1, y: 0, z: - 1, u: 1, v: 0, w: - 1, dir: 'z' },
			{ x: - 1, y: 0, z: 1, u: - 1, v: 0, w: 1, dir: 'z' },
			{ x: - 1, y: 0, z: - 1, u: - 1, v: 0, w: - 1, dir: 'z' },
			{ x: 0, y: 1, z: 1, u: 0, v: 1, w: 1, dir: 'x' },
			{ x: 0, y: - 1, z: 1, u: 0, v: - 1, w: 1, dir: 'x' },
			{ x: 0, y: 1, z: - 1, u: 0, v: 1, w: - 1, dir: 'x' },
			{ x: 0, y: - 1, z: - 1, u: 0, v: - 1, w: - 1, dir: 'x' }
		];

		for ( let i = 0; i < 12; i ++ ) {
			let layout = edgeLayout[ i ];
			let edgeIndex = positions.length / 3;

			for ( let j = 0; j < segments + 1; j ++ ) {
				let u = j / segments;
				let phi = pi2 * u / 4;

				n.set( Math.cos( phi ), Math.sin( phi ), 0 );
				p.copy( n ).multiplyScalar( radius );

				for ( let k = 0; k < 2; k ++ ) {
					let v = new Vector3( p.x, p.y, p.z );
					let nml = new Vector3( n.x, n.y, n.z );

					if ( layout.dir === 'x' ) {
						v.applyAxisAngle( new Vector3( 0, 1, 0 ), Math.PI / 2 );
						nml.applyAxisAngle( new Vector3( 0, 1, 0 ), Math.PI / 2 );
					} else if ( layout.dir === 'z' ) {
						v.applyAxisAngle( new Vector3( 1, 0, 0 ), - Math.PI / 2 );
						nml.applyAxisAngle( new Vector3( 1, 0, 0 ), - Math.PI / 2 );
					}

					if ( k === 0 ) {
						if ( layout.dir === 'y' ) v.y -= height;
						if ( layout.dir === 'z' ) v.z -= depth;
						if ( layout.dir === 'x' ) v.x -= width;
					} else {
						if ( layout.dir === 'y' ) v.y += height;
						if ( layout.dir === 'z' ) v.z += depth;
						if ( layout.dir === 'x' ) v.x += width;
					}

					v.x += radius * layout.u;
					v.y += radius * layout.v;
					v.z += radius * layout.w;

					positions.push( v.x, v.y, v.z );
					normals.push( nml.x, nml.y, nml.z );
				}
			}

			for ( let j = 0; j < segments; j ++ ) {
				let i1 = edgeIndex + j * 2;
				let i2 = edgeIndex + j * 2 + 1;
				let i3 = edgeIndex + ( j + 1 ) * 2 + 1;
				let i4 = edgeIndex + ( j + 1 ) * 2;

				indices.push( i1, i2, i4 );
				indices.push( i2, i3, i4 );
			}
		}

		// sides
		let sideLayout = [
			{ x: 1, y: 0, z: 0 },
			{ x: - 1, y: 0, z: 0 },
			{ x: 0, y: 1, z: 0 },
			{ x: 0, y: - 1, z: 0 },
			{ x: 0, y: 0, z: 1 },
			{ x: 0, y: 0, z: - 1 }
		];

		for ( let i = 0; i < 6; i ++ ) {
			let layout = sideLayout[ i ];
			let sideIndex = positions.length / 3;

			for ( let j = 0; j < 2; j ++ ) {
				for ( let k = 0; k < 2; k ++ ) {
					let v = new Vector3();
					v.x = j === 0 ? - 1 : 1;
					v.y = k === 0 ? - 1 : 1;
					v.z = 1;

					if ( layout.x !== 0 ) {
						v.x = layout.x > 0 ? 1 : - 1;
						v.y = j === 0 ? - 1 : 1;
						v.z = k === 0 ? - 1 : 1;
						v.x *= width + radius;
						v.y *= height;
						v.z *= depth;
					} else if ( layout.y !== 0 ) {
						v.x = j === 0 ? - 1 : 1;
						v.y = layout.y > 0 ? 1 : - 1;
						v.z = k === 0 ? - 1 : 1;
						v.x *= width;
						v.y *= height + radius;
						v.z *= depth;
					} else if ( layout.z !== 0 ) {
						v.x = j === 0 ? - 1 : 1;
						v.y = k === 0 ? - 1 : 1;
						v.z = layout.z > 0 ? 1 : - 1;
						v.x *= width;
						v.y *= height;
						v.z *= depth + radius;
					}

					positions.push( v.x, v.y, v.z );
					normals.push( layout.x, layout.y, layout.z );
				}
			}

			indices.push( sideIndex, sideIndex + 1, sideIndex + 2 );
			indices.push( sideIndex + 1, sideIndex + 3, sideIndex + 2 );
		}

		// FIX: Use `super` to explicitly call base class methods, resolving TypeScript errors where it fails to find these inherited methods on `this`.
		super.setIndex( indices );
		super.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
		super.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );
	}
}
